/**
 * Driver-scoring table ported verbatim from the v6 complexity analysis.
 * Pure functions; all thresholds documented inline.
 */

export type ComplexityLevel = "none" | "low" | "medium" | "high" | "very_high";

/** Level -> score, 0-4. Five drivers => overall score 0-20. */
export const LEVEL_SCORE: Record<ComplexityLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  very_high: 4,
};

export type ComplexityDriver =
  | "integration"
  | "migration"
  | "identity"
  | "portal"
  | "compliance";

/**
 * Integration: count of external systems to interface with.
 * 0 -> none, 1-2 -> low, 3-5 -> medium, 6-9 -> high, 10+ -> very_high.
 */
export function integrationLevel(integrationCount: number): ComplexityLevel {
  if (integrationCount <= 0) return "none";
  if (integrationCount <= 2) return "low";
  if (integrationCount <= 5) return "medium";
  if (integrationCount <= 9) return "high";
  return "very_high";
}

/**
 * Migration: legacy record volume moved into CaseX.
 * 0 -> none, <10k -> low, <100k -> medium, <1M -> high, 1M+ -> very_high.
 */
export function migrationLevel(recordCount: number): ComplexityLevel {
  if (recordCount <= 0) return "none";
  if (recordCount < 10_000) return "low";
  if (recordCount < 100_000) return "medium";
  if (recordCount < 1_000_000) return "high";
  return "very_high";
}

/**
 * Identity: authentication topology.
 * none -> none, single internal IdP -> low, SSO federation -> medium,
 * multi-IdP or external citizen identity -> high, both plus
 * step-up/MFA brokering -> very_high.
 */
export function identityLevel(input: {
  idpCount: number;
  externalCitizenIdentity: boolean;
  stepUpAuth: boolean;
}): ComplexityLevel {
  if (input.idpCount <= 0 && !input.externalCitizenIdentity) return "none";
  if (input.idpCount > 1 || input.externalCitizenIdentity) {
    return input.stepUpAuth && input.externalCitizenIdentity && input.idpCount > 1
      ? "very_high"
      : "high";
  }
  return input.stepUpAuth ? "medium" : "low";
}

/**
 * Portal: externally facing surfaces.
 * none -> none, read-only status portal -> low, transactional B2C -> medium,
 * B2C plus B2B partner portal -> high, plus multilingual/accessibility
 * certification -> very_high.
 */
export function portalLevel(input: {
  b2c: boolean;
  b2b: boolean;
  readOnlyOnly: boolean;
  multilingualOrCertifiedA11y: boolean;
}): ComplexityLevel {
  if (!input.b2c && !input.b2b) return "none";
  if (input.readOnlyOnly) return "low";
  if (input.b2c && input.b2b) {
    return input.multilingualOrCertifiedA11y ? "very_high" : "high";
  }
  return "medium";
}

/**
 * Compliance: regimes in scope.
 * 0 -> none, 1 standard regime -> low, 2 -> medium,
 * 3 or any federal audit regime (FedRAMP/CJIS/IRS-1075) -> high,
 * 4+ with federal audit regime -> very_high.
 */
export function complianceLevel(input: {
  regimeCount: number;
  hasFederalAuditRegime: boolean;
}): ComplexityLevel {
  if (input.regimeCount <= 0 && !input.hasFederalAuditRegime) return "none";
  if (input.hasFederalAuditRegime) {
    return input.regimeCount >= 4 ? "very_high" : "high";
  }
  if (input.regimeCount === 1) return "low";
  if (input.regimeCount === 2) return "medium";
  return "high";
}

export type DriverLevels = Record<ComplexityDriver, ComplexityLevel>;

export type ComplexityTier = 1 | 2 | 3 | 4;

export interface ComplexityResult {
  scores: Record<ComplexityDriver, number>;
  totalScore: number;
  tier: ComplexityTier;
}

/** Total score (0-20) -> tier. 0-4: 1, 5-9: 2, 10-14: 3, 15-20: 4. */
export function tierForScore(totalScore: number): ComplexityTier {
  if (totalScore <= 4) return 1;
  if (totalScore <= 9) return 2;
  if (totalScore <= 14) return 3;
  return 4;
}

/** Score every driver and roll them up into the overall tier. */
export function scoreComplexity(levels: DriverLevels): ComplexityResult {
  const scores = {
    integration: LEVEL_SCORE[levels.integration],
    migration: LEVEL_SCORE[levels.migration],
    identity: LEVEL_SCORE[levels.identity],
    portal: LEVEL_SCORE[levels.portal],
    compliance: LEVEL_SCORE[levels.compliance],
  };
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  return { scores, totalScore, tier: tierForScore(totalScore) };
}

/** One intake answer, used to derive confidence. */
export interface ComplexityAnswer {
  notSure: boolean;
  undocumented: boolean;
}

/**
 * Confidence percentage: 100 - 5 * (not-sure answers) - 3 *
 * (undocumented answers), floored at 40.
 */
export function confidence(answers: ComplexityAnswer[]): number {
  const notSure = answers.filter((a) => a.notSure).length;
  const undocumented = answers.filter((a) => a.undocumented).length;
  return Math.max(40, 100 - 5 * notSure - 3 * undocumented);
}
