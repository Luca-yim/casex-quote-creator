import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useIntake } from "@/features/intake/IntakeContext";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { calculatePricingBreakdown } from "@/lib/calculation-engine";
import { buildAssumptions, type Assumption } from "@/lib/assumptions-builder";
import { readinessCheck } from "@/lib/quote-validation";
import { cn, formatCurrency } from "@/lib/utils";
import { useWbsLines, useQuoteCostItems } from "@/features/wbs/useWbsData";
import { useBallparkSizingReference } from "@/features/estimator-ballpark/useBallparkSizingReference";
import {
  computeBallparkForQuote,
  resolveBallparkTier,
  type BallparkQuoteInput,
} from "@/features/estimator-ballpark/computeBallparkForQuote";
import { ProposalPricingBlock } from "./ProposalPricingBlock";

/** Formats a short relative time such as "2s ago" / "4m ago". */
function relativeTime(from: Date, now: number): string {
  const seconds = Math.max(0, Math.round((now - from.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const TONE_ICON: Record<Assumption["tone"], typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
};

const TONE_CLASS: Record<Assumption["tone"], string> = {
  info: "text-secondary",
  success: "text-emerald-600",
  warning: "text-amber-600",
};

const CONFIDENCE_META = {
  high: { label: "High confidence", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" },
  medium: { label: "Medium confidence", className: "border-amber-500/40 bg-amber-500/10 text-amber-700" },
  low: { label: "Low confidence", className: "border-red-500/40 bg-red-500/10 text-red-700" },
} as const;

/**
 * Right-hand pricing sidebar. Always shows tier, readiness, assumptions and
 * save status; monetary detail renders only when the role/state allows it.
 */
export function PricingSidebar() {
  const { quote, role, mode, showPricing, isSaving, lastSavedAt, updateField } =
    useIntake();
  const { data: catalog } = usePricingCatalog();


  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const breakdown = useMemo(
    () => (catalog ? calculatePricingBreakdown(quote, catalog) : null),
    [quote, catalog],
  );

  const readiness = readinessCheck(quote);
  const percent = Math.round(
    (readiness.completedCount / Math.max(1, readiness.totalRequired)) * 100,
  );

  const assumptions = useMemo(() => {
    const all = buildAssumptions(quote);
    if (role === "estimator" || role === "admin") return all;
    return all.filter((a) => a.tone !== "warning");
  }, [quote, role]);

  // Margin controls are estimator-only, and never available in read-only mode.
  const canEditMargin =
    (role === "estimator" || role === "admin") && mode === "edit";
  const savedMargin = quote.marginPercent ?? 20;
  // The slider tracks locally while dragging; the write happens on release so
  // a single adjustment is one save, not twenty. Margin is full estimator
  // discretion — any value 0–100 commits immediately, no band, no gate.
  const [draftMargin, setDraftMargin] = useState<number | null>(null);
  const margin = draftMargin ?? savedMargin;

  const commitMargin = (value: number) => {
    setDraftMargin(value);
    updateField("marginPercent", value);
  };

  // Proposal-tier only: WBS-backed cost basis for the real computed price.
  const isProposal = quote.tier === "proposal";
  const { data: wbsLines } = useWbsLines(quote.id, isProposal);
  const { data: wbsItems } = useQuoteCostItems(quote.id, isProposal);
  const engineLines = useMemo(
    () =>
      (wbsLines ?? []).map((l) => ({
        costHours: l.costHours,
        costRate: l.costRate,
        revenueHours: l.revenueHours,
        billRate: l.billRate,
      })),
    [wbsLines],
  );
  const engineItems = useMemo(
    () => (wbsItems ?? []).map((i) => ({ amount: i.amount })),
    [wbsItems],
  );
  const totalHours = useMemo(
    () => engineLines.reduce((sum, l) => sum + l.revenueHours, 0),
    [engineLines],
  );

  // Ballpark-tier only: estimated implementation fee range, reusing the same
  // pricing-engine composition as the estimator ballpark card.
  const isBallpark = quote.tier === "ballpark";
  const ballparkInput = quote as unknown as BallparkQuoteInput;
  const ballparkTier = useMemo(
    () => (isBallpark ? resolveBallparkTier(ballparkInput) : null),
    [isBallpark, ballparkInput],
  );
  const { data: sizingRows } = useBallparkSizingReference(ballparkTier);
  const ballpark = useMemo(
    () =>
      isBallpark
        ? computeBallparkForQuote(ballparkInput, sizingRows ?? [])
        : null,
    [isBallpark, ballparkInput, sizingRows],
  );

  const handleJustificationChange = (text: string) => {
    updateField("marginJustification", text || null);
  };

  const oneTimeItems = breakdown?.lineItems.filter((i) => i.category === "one_time") ?? [];
  const monthlyItems = breakdown?.lineItems.filter((i) => i.category === "monthly") ?? [];
  const hasLineItems = (breakdown?.lineItems.length ?? 0) > 0;

  const adjustment = breakdown?.repeatableActivationAdjustment ?? 0;
  const adjustmentPercent =
    breakdown && breakdown.baselineTCV > 0
      ? Math.round((adjustment / breakdown.baselineTCV) * 1000) / 10
      : 0;

  // External requesters get a status-only panel: no pricing, no readiness,
  // nothing that could imply a price exists for them to see.
  if (role === "external" && mode === "readonly") {
    return (
      <aside className="w-full rounded-lg border bg-card p-5">
        <p className="text-sm font-medium">Request received</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your request has been reviewed. A Speridian sales representative will
          be in touch shortly to discuss next steps.
        </p>
      </aside>
    );
  }

  return (
    <aside className="sticky top-16 max-h-[calc(100vh-4rem)] w-full space-y-5 overflow-y-auto rounded-lg border bg-card p-5">

      {/* A — Tier badge */}
      <div>
        <Badge variant="secondary" className="uppercase tracking-wide">
          {quote.tier === "proposal" ? "Proposal Tier" : "Ballpark Tier"}
        </Badge>
      </div>

      {/* B — TCV */}
      {showPricing && breakdown ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Total Contract Value ({breakdown.contractYears}-year)
          </p>
          <p className="font-mono text-4xl font-semibold tracking-tight">
            {formatCurrency(breakdown.finalTCV)}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Updated live
          </span>
        </div>
      ) : null}

      <Separator />

      {/* C — Progress */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {readiness.completedCount} of {readiness.totalRequired} required fields
          complete
        </p>
        <Progress value={percent} aria-label="Quote completion" />
        {readiness.ready ? (
          <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Ready to submit
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            {readiness.missing.length} required fields missing
          </span>
        )}
      </div>

      {/* Pricing empty state */}
      {showPricing && !hasLineItems ? (
        <>
          <Separator />
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Start by picking a module tier to see pricing.
          </p>
        </>
      ) : null}

      {/* D — Subtotals */}
      {showPricing && breakdown && hasLineItems ? (
        <>
          <Separator />
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">One-time cost</span>
              <span className="font-mono">{formatCurrency(breakdown.oneTimeTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly recurring</span>
              <span className="font-mono">
                {formatCurrency(breakdown.monthlyRecurring)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract term</span>
              <span className="font-mono">{breakdown.contractYears} years</span>
            </div>
          </div>
        </>
      ) : null}

      {/* E — Repeatable activation adjustment */}
      {showPricing && breakdown && adjustment !== 0 ? (
        <span className="inline-flex rounded-full border border-teal-500/40 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-700">
          Repeatability adjustment: {formatCurrency(adjustment)} ({adjustmentPercent}%)
        </span>
      ) : null}

      {/* F — Margin slider */}
      {canEditMargin ? (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="margin-slider" className="text-sm">
                Margin
              </Label>
              <span className="font-mono text-sm">{margin}% margin</span>
            </div>
            <Slider
              id="margin-slider"
              min={0}
              max={100}
              step={1}
              value={[margin]}
              onValueChange={(v) => setDraftMargin(v[0] ?? savedMargin)}
              onValueCommit={(v) => commitMargin(v[0] ?? savedMargin)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="margin-justification" className="text-xs">
                Margin justification (optional)
              </Label>
              <Textarea
                id="margin-justification"
                rows={3}
                placeholder="Why is this margin appropriate?"
                value={quote.marginJustification ?? ""}
                onChange={(e) => handleJustificationChange(e.target.value)}
              />
            </div>
            {isProposal ? (
              <ProposalPricingBlock
                quote={quote}
                lines={engineLines}
                items={engineItems}
                totalHours={totalHours}
                canEdit={canEditMargin}
                onChange={(pct) => updateField("contingencyPct", pct)}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {/* G — Line items */}
      {showPricing && hasLineItems ? (
        <div className="rounded-lg border">
          <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Line items
          </p>
          <div className="divide-y">
            {[oneTimeItems, monthlyItems]
              .filter((group) => group.length > 0)
              .map((group) => (
                <div key={group[0]!.category} className="space-y-2 p-3">
                  {group.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm">{item.label}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {item.category === "one_time" ? "one-time" : "monthly"}
                          </Badge>
                          {item.quantity > 1 ? (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              × {item.quantity}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-sm">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {/* H — Assumptions */}
      {assumptions.length > 0 ? (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assumptions
            </p>
            {assumptions.map((a) => {
              const Icon = TONE_ICON[a.tone];
              return (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", TONE_CLASS[a.tone])} />
                  <span className="text-muted-foreground">{a.text}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* I — Risk snapshot */}
      {quote.repConfidence ? (
        <div>
          <span
            className={cn(
              "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
              CONFIDENCE_META[quote.repConfidence].className,
            )}
          >
            {CONFIDENCE_META[quote.repConfidence].label}
          </span>
        </div>
      ) : null}

      {/* J — Save status */}
      <Separator />
      <div className="space-y-2 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
            </>
          ) : lastSavedAt ? (
            <>💾 Saved · {relativeTime(lastSavedAt, now)}</>
          ) : (
            <>💾 Not yet saved</>
          )}
        </p>
        <p>
          Ballpark tier — internal estimate. Requires estimator approval before
          sharing with customer.
        </p>
      </div>
    </aside>
  );
}
