/**
 * Ballpark range estimation. Sizing reference rows come from the
 * admin-editable `ballpark_sizing_reference` table and are passed in, so
 * the database stays the single source of truth.
 */

import type { ComplexityTier } from "./complexity";

export type ProgramType = "public_sector" | "commercial";

/**
 * One row of `ballpark_sizing_reference` as it really exists: one row per
 * tier (1-4), carrying both program bands as columns on the same row.
 */
export interface BallparkSizingRow {
  tier: ComplexityTier;
  tier_label?: string | null;
  hours_low: number;
  hours_high: number;
  commercial_rate_low: number;
  commercial_rate_high: number;
  public_sector_rate_low: number;
  public_sector_rate_high: number;
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
 * @throws when no sizing row exists for the tier, or the row has no rate
 *         band for the requested program type.
 */
export function ballparkRange(
  tier: ComplexityTier,
  programType: ProgramType,
  confidencePct: number,
  sizing: BallparkSizingRow[],
): BallparkRange {
  const row = sizing.find((r) => r.tier === tier);
  if (!row) {
    throw new Error(`No ballpark sizing row for tier ${tier}`);
  }

  const rateLow =
    programType === "commercial"
      ? row.commercial_rate_low
      : row.public_sector_rate_low;
  const rateHigh =
    programType === "commercial"
      ? row.commercial_rate_high
      : row.public_sector_rate_high;
  if (
    rateLow === null ||
    rateLow === undefined ||
    rateHigh === null ||
    rateHigh === undefined
  ) {
    throw new Error(
      `No ${programType} rate band on ballpark sizing row for tier ${tier}`,
    );
  }

  const spread = (100 - confidencePct) / 200;
  const low = row.hours_low * rateLow;
  const high = row.hours_high * rateHigh;

  return {
    implementationLow: low * (1 - spread),
    implementationHigh: high * (1 + spread),
  };
}
