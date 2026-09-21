import { supabase } from "@/lib/supabase";
import type { Quote } from "@/types/quote";
import type { ProposalTotals } from "./proposalTotal";
import { computeProposalTotals } from "./proposalTotal";
import { grandTotalCost, totalImplementationFee } from "./fullQuote";
import type { CostItemRow, WbsLineRow } from "@/features/wbs/useWbsData";
import { fetchQuoteCostItems, fetchWbsLines } from "@/features/wbs/useWbsData";
import { calculatePricingBreakdown } from "@/lib/calculation-engine";
import type { PricingBreakdown, PricingCatalogRow } from "@/types/pricing";

export const PRICING_SNAPSHOT_KEY = "__pricingSnapshot";

/** Approval-time price snapshot stored inside the quote_versions snapshot. */
export interface ProposalPricingSnapshot {
  computedAt: string;
  tier: "proposal";
  marginPercent: number;
  contingencyPct: number;
  implementationFee: number;
  totals: ProposalTotals;
  catalogLineItems: PricingBreakdown;
  wbsLines: WbsLineRow[];
  costItems: CostItemRow[];
}

export function extractPricingSnapshot(snapshot: unknown): ProposalPricingSnapshot | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const candidate = (snapshot as Record<string, unknown>)[PRICING_SNAPSHOT_KEY];
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  if (record["tier"] !== "proposal" || !record["totals"]) return null;
  return candidate as ProposalPricingSnapshot;
}

async function fetchCatalog(): Promise<PricingCatalogRow[]> {
  const { data, error } = await supabase
    .from("pricing_catalog")
    .select("*")
    .order("sku_id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    sku_id: row.sku_id,
    name: row.name,
    category: row.category as PricingCatalogRow["category"],
    unit_price: Number(row.unit_price),
    naspo_discount_price:
      (row as { naspo_discount_price?: number | null }).naspo_discount_price == null
        ? null
        : Number((row as { naspo_discount_price?: number | null }).naspo_discount_price),
    unit_type: row.unit_type as PricingCatalogRow["unit_type"],
    tier_range: Array.isArray(row.tier_range)
      ? ([Number(row.tier_range[0]), Number(row.tier_range[1])] as [number, number])
      : null,
    effective_date: row.effective_date,
    expiration_date: row.expiration_date,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  }));
}

/**
 * Builds the frozen price snapshot captured when a Proposal is approved.
 *
 * Failures surface as errors so callers can decide whether to block approval;
 * the stored quote JSON itself remains the fallback record.
 */
export async function buildProposalPricingSnapshot(
  quote: Quote,
): Promise<ProposalPricingSnapshot> {
  const [catalog, wbsLines, costItems] = await Promise.all([
    fetchCatalog(),
    fetchWbsLines(quote.id),
    fetchQuoteCostItems(quote.id),
  ]);
  const breakdown = calculatePricingBreakdown(quote, catalog);
  const cost = grandTotalCost(wbsLines, costItems);
  const fee = totalImplementationFee(quote.marginPercent, cost, quote.contingencyPct);
  return {
    computedAt: new Date().toISOString(),
    tier: "proposal",
    marginPercent: quote.marginPercent,
    contingencyPct: quote.contingencyPct,
    implementationFee: fee,
    totals: computeProposalTotals(fee, breakdown),
    catalogLineItems: breakdown,
    wbsLines,
    costItems,
  };
}
