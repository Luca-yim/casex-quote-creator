/**
 * Full-quote pricing math. Pure functions only: no Supabase client, no
 * framework imports. All reference data is passed in as parameters.
 */

/** One WBS row: cost side (delivery) and revenue side (billable). */
export interface WbsLine {
  costHours: number;
  costRate: number;
  revenueHours: number;
  billRate: number;
}

/** A non-labor cost line (travel, licenses, pass-throughs). */
export interface CostItem {
  amount: number;
}

/**
 * Total delivery cost basis: labor cost from every WBS line plus all
 * non-labor cost items.
 */
export function grandTotalCost(lines: WbsLine[], items: CostItem[]): number {
  const labor = lines.reduce((sum, l) => sum + l.costHours * l.costRate, 0);
  const other = items.reduce((sum, i) => sum + i.amount, 0);
  return labor + other;
}

/** Reference margin scenarios shown to estimators for comparison only. */
export const MARGIN_SCENARIOS = [0.25, 0.3, 0.35, 0.4] as const;

/** One reference scenario row. */
export interface MarginScenario {
  /** Margin as a fraction, e.g. 0.35. */
  margin: number;
  /** Revenue implied by that margin. */
  revenue: number;
  /** Revenue per total hour; 0 when totalHours is 0. */
  blendedRate: number;
}

/**
 * REFERENCE ONLY. Mirrors the `pricing_scenarios` table's role: it shows
 * what revenue and blended rate each margin would imply. It never feeds
 * the binding quote price.
 */
export function marginScenarios(
  grandTotalCost: number,
  totalHours: number,
): MarginScenario[] {
  return MARGIN_SCENARIOS.map((margin) => {
    const revenue = grandTotalCost / (1 - margin);
    return {
      margin,
      revenue,
      blendedRate: totalHours > 0 ? revenue / totalHours : 0,
    };
  });
}

/**
 * The one function that produces the real, binding price. Driven by
 * `quotes.margin_percent` (the free 0-100 estimator slider), never by a
 * selected reference scenario.
 *
 * @param marginPercent 0-100. At 100 the margin is undefined (divide by
 * zero), so it is treated as an invalid input and returns Infinity only
 * when cost is positive; a zero cost yields 0.
 * @param contingencyPct Fraction, e.g. 0.05 for 5%.
 */
export function totalImplementationFee(
  marginPercent: number,
  grandTotalCost: number,
  contingencyPct: number,
): number {
  const denominator = 1 - marginPercent / 100;
  if (denominator <= 0) {
    return grandTotalCost === 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  const revenue = grandTotalCost / denominator;
  return revenue * (1 + contingencyPct);
}

/** Qualitative complexity bands used by contingency suggestion. */
export type ContingencyLevel = "none" | "low" | "medium" | "high" | "very_high";

export interface ContingencyDrivers {
  migrationComplexity: ContingencyLevel;
  hasUndocumentedIntegration: boolean;
  complianceComplexity: ContingencyLevel;
}

/**
 * Suggested contingency fraction. Suggestion only — the estimator can
 * override it in the UI.
 */
export function suggestedContingency(drivers: ContingencyDrivers): number {
  let pct = 0.03;
  if (
    drivers.migrationComplexity === "high" ||
    drivers.migrationComplexity === "very_high"
  ) {
    pct += 0.02;
  }
  if (drivers.hasUndocumentedIntegration) pct += 0.02;
  if (drivers.complianceComplexity === "very_high") pct += 0.03;
  return pct;
}
