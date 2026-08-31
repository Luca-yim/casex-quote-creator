import { useMemo, useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { useIntake } from "@/features/intake/IntakeContext";
import { useBallparkSizingReference } from "./useBallparkSizingReference";
import {
  computeBallparkForQuote,
  type BallparkQuoteInput,
} from "./computeBallparkForQuote";

const DRIVER_LABEL: Record<string, string> = {
  integration: "Integration",
  migration: "Migration",
  identity: "Identity",
  portal: "Portal",
  compliance: "Compliance",
};

const LEVEL_LABEL: Record<string, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  very_high: "Very high",
};

/**
 * Estimator-facing ballpark reference. Read-only context: nothing here is
 * written to the quote and it never auto-fills the margin.
 */
export function BallparkRangeCard() {
  const { quote } = useIntake();
  const sizingQuery = useBallparkSizingReference();
  const [open, setOpen] = useState(false);

  const result = useMemo(
    () =>
      computeBallparkForQuote(
        quote as unknown as BallparkQuoteInput,
        sizingQuery.data ?? [],
      ),
    [quote, sizingQuery.data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="size-4 text-muted-foreground" aria-hidden />
          Ballpark range
        </CardTitle>
        <CardDescription>
          Reference only — you still set the margin yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result ? (
          <p className="text-sm text-muted-foreground">
            {sizingQuery.isLoading
              ? "Loading sizing reference…"
              : "Not enough information yet to produce a ballpark range."}
          </p>
        ) : (
          <>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {formatCurrency(result.implementationLow)} –{" "}
                {formatCurrency(result.implementationHigh)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">Tier {result.tier}</Badge>
                <Badge variant="outline">
                  {result.confidencePct}% confidence
                </Badge>
                <Badge variant="outline">
                  {result.programType === "commercial"
                    ? "Commercial"
                    : "Public sector"}
                </Badge>
              </div>
            </div>

            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <ChevronDown
                  className={cn("size-4 transition-transform", open && "rotate-180")}
                  aria-hidden
                />
                Driver breakdown
              </Button>
              {open ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {result.driverBreakdown.map((d) => (
                    <li
                      key={d.driver}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-muted-foreground">
                        {DRIVER_LABEL[d.driver]}
                        {d.answered ? "" : " (not answered)"}
                      </span>
                      <span className="tabular-nums">
                        {LEVEL_LABEL[d.level]} · {d.score}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
