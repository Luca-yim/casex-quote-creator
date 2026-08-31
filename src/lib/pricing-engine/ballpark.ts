/**
 * Ballpark range estimation. Sizing reference rows come from the
 * admin-editable `ballpark_sizing_reference` table and are passed in, so
 * the database stays the single source of truth.
 */

import type { ComplexityTier } from "./complexity";

export type ProgramType = "public_sector" | "commercial";

/** One row of `ballpark_sizing_reference`. */
export interface BallparkSizingRow {
  tier: ComplexityTier;
  program_type: ProgramType;
  hours_low: number;
  hours_high: number;
  rate_low: number;
  rate_high: number;
}

export interface BallparkRange {
  implementationLow: number;
  implementationHigh: number;
}

/**
 * Look up the tier/program band and widen it by the uncertainty implied
 * by `confidencePct`:
 *   low'  = low  * (1 - (100 - confidence) / 200)
 *   high' = high * (1 + (100 - confidence) / 200)
 *
 * @throws when no sizing row matches the tier and program type.
 */
export function ballparkRange(
  tier: ComplexityTier,
  programType: ProgramType,
  confidencePct: number,
  sizing: BallparkSizingRow[],
): BallparkRange {
  const row = sizing.find(
    (r) => r.tier === tier && r.program_type === programType,
  );
  if (!row) {
    throw new Error(
      `No ballpark sizing row for tier ${tier} / ${programType}`,
    );
  }

  const spread = (100 - confidencePct) / 200;
  const low = row.hours_low * row.rate_low;
  const high = row.hours_high * row.rate_high;

  return {
    implementationLow: low * (1 - spread),
    implementationHigh: high * (1 + spread),
  };
}
