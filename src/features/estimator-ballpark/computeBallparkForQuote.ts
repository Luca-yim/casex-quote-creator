/**
 * Composes the pure pricing-engine primitives with a quote row into the
 * estimator-facing ballpark reference figure.
 *
 * Lives here rather than in `src/lib/pricing-engine/` because it encodes
 * app-level decisions (which DB field stands in for program type, what
 * counts as "not enough information"), while the engine stays generic.
 */
import {
  scoreComplexity,
  confidence,
  type ComplexityLevel,
  type ComplexityTier,
  type ComplexityAnswer,
} from "@/lib/pricing-engine/complexity";
import {
  ballparkRange,
  type BallparkSizingRow,
  type ProgramType,
} from "@/lib/pricing-engine/ballpark";
import {
  mapQuoteToDrivers,
  type DriverQuoteInput,
} from "@/lib/pricing-engine/mapQuoteToDrivers";

/**
 * The quote fields this composition reads.
 *
 * NOTE: there is no `program_type` / `programType` column on `quotes` today.
 * The closest real field is `customer_type`, so program type is derived from
 * it rather than invented: `commercial` maps to the commercial band and every
 * government classification (state NASPO/non-NASPO, federal, county, tribal)
 * maps to the public-sector band.
 */
export interface BallparkQuoteInput extends DriverQuoteInput {
  customerType?: string | null;
}

export interface BallparkDriverBreakdown {
  driver: "integration" | "migration" | "identity" | "portal" | "compliance";
  level: ComplexityLevel;
  score: number;
  /** False when the intake question behind this driver is still unanswered. */
  answered: boolean;
}

export interface BallparkForQuote {
  implementationLow: number;
  implementationHigh: number;
  confidencePct: number;
  tier: ComplexityTier;
  programType: ProgramType;
  driverBreakdown: BallparkDriverBreakdown[];
}

/** Derive the sizing-table program band from `customer_type`. */
export function programTypeForCustomerType(
  customerType: string | null | undefined,
): ProgramType | null {
  if (!customerType) return null;
  return customerType === "commercial" ? "commercial" : "public_sector";
}

/** Which of the five driver questions the requester actually answered. */
function answeredDrivers(q: BallparkQuoteInput) {
  return {
    integration: q.hasIntegrations !== null && q.hasIntegrations !== undefined,
    migration:
      q.migrationRequired !== null && q.migrationRequired !== undefined,
    identity:
      (q.externalIdpRequired !== null && q.externalIdpRequired !== undefined) ||
      (q.workerIdpRequired !== null && q.workerIdpRequired !== undefined),
    portal:
      (q.includeB2c !== null && q.includeB2c !== undefined) ||
      (q.includeB2bPortal !== null && q.includeB2bPortal !== undefined),
    compliance: Array.isArray(q.compliance),
  } as const;
}

/**
 * Returns the ballpark reference figure, or `null` when the inputs cannot
 * support one — no customer type, no sizing rows for the resolved
 * tier/program band, or not a single driver question answered yet.
 *
 * This is a read-only reference for the estimator: it is never written to the
 * quote and never auto-fills `margin_percent`.
 */
export function computeBallparkForQuote(
  quote: BallparkQuoteInput,
  sizingRows: BallparkSizingRow[],
): BallparkForQuote | null {
  const programType = programTypeForCustomerType(quote.customerType);
  if (!programType) return null;
  if (!sizingRows || sizingRows.length === 0) return null;

  const answered = answeredDrivers(quote);
  if (!Object.values(answered).some(Boolean)) return null;

  const drivers = mapQuoteToDrivers(quote);
  const { scores, tier } = scoreComplexity(drivers);

  // One confidence answer per driver: unanswered questions read as "not sure",
  // and the identity driver additionally carries the only real
  // documented/undocumented signal the intake collects today.
  const answers: ComplexityAnswer[] = (
    ["integration", "migration", "identity", "portal", "compliance"] as const
  ).map((driver) => ({
    notSure: !answered[driver],
    undocumented: driver === "identity" && drivers.hasUndocumentedIntegration,
  }));
  const confidencePct = confidence(answers);

  let range;
  try {
    range = ballparkRange(tier, programType, confidencePct, sizingRows);
  } catch {
    // No sizing row for this tier/program band — surface "not enough
    // information" rather than a misleading $0 range.
    return null;
  }

  return {
    implementationLow: range.implementationLow,
    implementationHigh: range.implementationHigh,
    confidencePct,
    tier,
    programType,
    driverBreakdown: (
      ["integration", "migration", "identity", "portal", "compliance"] as const
    ).map((driver) => ({
      driver,
      level: drivers[driver],
      score: scores[driver],
      answered: answered[driver],
    })),
  };
}
