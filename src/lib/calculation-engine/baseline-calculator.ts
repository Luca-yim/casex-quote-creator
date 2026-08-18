import type { LineItem, PricingBreakdown, PricingCatalogRow } from "@/types/pricing";
import type { Compliance, HostingModel, Quote } from "@/types/quote";
import { calculateB2cLineItem } from "./b2c-portal-packs";
import { calculateCaseWorkerLineItem } from "./case-worker-tiers";
import { findSku, toLineItem } from "./catalog-utils";
import { calculateContractTCV } from "./contract-tcv";
import {
  applyMargin,
  applyRepeatableActivationAdjustment,
} from "./final-price";
import {
  calculateSupportLineItem,
  recommendSupportTier,
} from "./support-tier-selection";

/** Fields of a quote the engine actually reads. */
export type PricingQuoteInput = Pick<
  Quote,
  | "repeatableActivation"
  | "moduleTier"
  | "contractYears"
  | "caseWorkerCount"
  | "includeB2c"
  | "b2cMau"
  | "includeB2bPortal"
  | "b2bUserCount"
  | "hostingModel"
  | "environmentCount"
  | "supportTier"
  | "marginPercent"
> & { compliance?: Compliance[] };

/** Compliance regimes that force a FedRAMP hosting posture. */
const FEDRAMP_FORCING: Compliance[] = ["fedramp_high", "cjis", "irs_1075"];

/**
 * Resolves effective hosting: FedRAMP High, CJIS or IRS 1075 override any
 * lesser hosting selection.
 */
function resolveHostingModel(
  selected: HostingModel | null,
  compliance: Compliance[],
): { model: HostingModel | null; forced: boolean } {
  const forced = compliance.some((c) => FEDRAMP_FORCING.includes(c));
  if (forced) return { model: "fedramp", forced: true };
  return { model: selected, forced: false };
}

/**
 * Main orchestrator: builds every applicable line item from the catalog and
 * rolls them up into a full pricing breakdown.
 *
 * Line items are skipped whenever their quantity is 0/false or the catalog
 * lacks the SKU. Totals follow: one-time sum, monthly sum, annual = monthly*12,
 * baseline TCV = one-time + monthly*12*years, minus the repeatable activation
 * discount, then grossed up by margin.
 */
export function calculatePricingBreakdown(
  quote: PricingQuoteInput,
  catalog: PricingCatalogRow[],
): PricingBreakdown {
  const compliance = quote.compliance ?? [];
  const lineItems: LineItem[] = [];

  // Module tier — one-time platform fee.
  if (quote.moduleTier) {
    const row = findSku(catalog, `module_${quote.moduleTier}`);
    if (row) {
      const item = toLineItem(row, 1, `${quote.moduleTier} module tier`);
      if (item) lineItems.push(item);
    }
  }

  // Case worker licensing — monthly, tiered by headcount.
  const caseWorkerCount = quote.caseWorkerCount ?? 0;
  const caseWorkers = calculateCaseWorkerLineItem(caseWorkerCount, catalog);
  if (caseWorkers) lineItems.push(caseWorkers);

  // B2C portal pack — monthly, sized by MAU.
  const b2cMau = quote.includeB2c ? (quote.b2cMau ?? 0) : 0;
  const b2c = calculateB2cLineItem(b2cMau, catalog);
  if (b2c) lineItems.push(b2c);

  // B2B portal users — monthly, per user.
  const b2bUsers = quote.includeB2bPortal ? (quote.b2bUserCount ?? 0) : 0;
  if (b2bUsers > 0) {
    const row = findSku(catalog, "b2b_user");
    if (row) {
      const item = toLineItem(row, b2bUsers, `${b2bUsers} B2B portal users`);
      if (item) lineItems.push(item);
    }
  }

  // Hosting — monthly, per environment (customer-hosted is not billed).
  const { model: hostingModel, forced } = resolveHostingModel(
    quote.hostingModel,
    compliance,
  );
  if (hostingModel && hostingModel !== "customer_hosted") {
    const row = findSku(catalog, `hosting_${hostingModel}`);
    if (row) {
      const item = toLineItem(
        row,
        Math.max(quote.environmentCount, 0),
        forced
          ? "FedRAMP hosting required by compliance selection"
          : `${quote.environmentCount} environments`,
      );
      if (item) lineItems.push(item);
    }
  }

  // Support — monthly; auto-recommended when the quote has no explicit tier.
  const supportTier =
    quote.supportTier ?? recommendSupportTier(caseWorkerCount + b2bUsers);
  const support = calculateSupportLineItem(supportTier, catalog);
  if (support) lineItems.push(support);

  const oneTimeTotal = lineItems
    .filter((i) => i.category === "one_time")
    .reduce((sum, i) => sum + i.subtotal, 0);
  const monthlyRecurring = lineItems
    .filter((i) => i.category === "monthly")
    .reduce((sum, i) => sum + i.subtotal, 0);
  const annualRecurring = monthlyRecurring * 12;

  const contractYears = quote.contractYears;
  const baselineTCV = calculateContractTCV(
    oneTimeTotal,
    monthlyRecurring,
    contractYears,
  );
  const repeatableActivationAdjustment = applyRepeatableActivationAdjustment(
    baselineTCV,
    quote.repeatableActivation,
  );
  const adjustedBaseline = baselineTCV + repeatableActivationAdjustment;
  const finalTCV = applyMargin(adjustedBaseline, quote.marginPercent);

  return {
    lineItems,
    oneTimeTotal,
    monthlyRecurring,
    annualRecurring,
    contractYears,
    baselineTCV,
    repeatableActivationAdjustment,
    adjustedBaseline,
    marginPercent: quote.marginPercent,
    finalTCV,
  };
}
