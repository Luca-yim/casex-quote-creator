import { useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  grandTotalCost,
  marginScenarios,
  totalImplementationFee,
  type CostItem,
  type WbsLine,
} from "@/lib/pricing-engine/fullQuote";
import { resolveContingency } from "@/lib/pricing-engine/resolveContingency";
import type { Quote } from "@/types/quote";
import { formatCurrency } from "@/lib/utils";

export interface ProposalPricingBlockProps {
  quote: Quote;
  lines: WbsLine[];
  items: CostItem[];
  /** Total hours used for the reference blended-rate column. */
  totalHours: number;
  /** Estimator/admin in edit mode. */
  canEdit: boolean;
  onChange: (contingencyPct: number) => void;
}

/**
 * Proposal-tier pricing block: contingency control, read-only margin
 * scenarios (reference only) and the one binding computed price.
 * Renders nothing unless the quote is proposal tier with real cost.
 */
export function ProposalPricingBlock({
  quote,
  lines,
  items,
  totalHours,
  canEdit,
  onChange,
}: ProposalPricingBlockProps) {
  const cost = useMemo(() => grandTotalCost(lines, items), [lines, items]);
  // Shared rule with both PDFs: stored value (0 honoured) or, when NULL,
  // the driver-based suggestion. Never written on mount.
  const resolved = useMemo(() => resolveContingency(quote), [quote]);
  const suggested = useMemo(
    () => resolveContingency({ ...quote, contingencyPct: null }).pct,
    [quote],
  );

  // Same commit-on-release pattern as the margin slider.
  const [draftContingency, setDraftContingency] = useState<number | null>(null);
  const contingency = draftContingency ?? resolved.pct;
  const isSuggested = draftContingency === null && resolved.isSuggested;

  if (quote.tier !== "proposal" || cost <= 0) return null;

  const scenarios = marginScenarios(cost, totalHours);
  const margin = quote.marginPercent;
  const price =
    margin === null ? null : totalImplementationFee(margin, cost, contingency);
  const displayPct = Math.round(contingency * 1000) / 10;

  const commitContingency = (pct: number) => {
    setDraftContingency(pct);
    onChange(pct);
  };

  return (
    <div data-testid="proposal-pricing-block" className="space-y-4">
      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="contingency-slider" className="text-sm">
            Contingency
          </Label>
          <span className="font-mono text-sm" data-testid="contingency-display">
            {displayPct}%{isSuggested ? " (suggested)" : ""}
          </span>
        </div>
        <Slider
          id="contingency-slider"
          aria-label="Contingency percent"
          min={0}
          max={100}
          step={1}
          disabled={!canEdit}
          value={[Math.round(contingency * 100)]}
          onValueChange={(v) => setDraftContingency((v[0] ?? 0) / 100)}
          onValueCommit={(v) => commitContingency((v[0] ?? 0) / 100)}
        />
        <p className="text-xs text-muted-foreground">
          Suggested {Math.round(suggested * 1000) / 10}% based on migration,
          integration and compliance drivers.
        </p>
      </div>

      <div className="rounded-lg border">
        <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Margin scenarios (reference only)
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-normal">Margin</th>
              <th className="px-3 py-1.5 text-right font-normal">Revenue</th>
              <th className="px-3 py-1.5 text-right font-normal">Blended</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {scenarios.map((s) => (
              <tr key={s.margin} data-testid={`scenario-${Math.round(s.margin * 100)}`}>
                <td className="px-3 py-1.5">{Math.round(s.margin * 100)}%</td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {formatCurrency(s.revenue)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {formatCurrency(s.blendedRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Display only — scenarios never set the quote price.
        </p>
      </div>

      <div className="space-y-1 rounded-lg border bg-muted/40 p-4">
        {price === null ? (
          <p data-testid="computed-price-not-set" className="text-sm font-medium">
            Implementation fee not available: margin not set
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Total implementation fee ({margin}% margin + {displayPct}%
              {isSuggested ? " suggested" : ""} contingency)
            </p>
            <p
              data-testid="computed-price"
              className="font-mono text-3xl font-semibold tracking-tight"
            >
              {formatCurrency(price)}
            </p>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Delivery cost basis {formatCurrency(cost)}
        </p>
      </div>
    </div>
  );
}
