/**
 * Pure mapping from intake answers to the five complexity-driver levels that
 * `complexity.ts` scores. No Supabase, no framework imports.
 */
import type { ComplexityLevel, DriverLevels } from "./complexity";

/** The subset of a Quote this mapping reads. */
export interface DriverQuoteInput {
  hasIntegrations?: boolean | null;
  integrationCount?: number | null;
  integrationDifficulty?:
    | "simple"
    | "moderate"
    | "complex"
    | "very_complex"
    | null;
  migrationRequired?: boolean | null;
  migrationVolumeRange?: "<100k" | "100k-1m" | "1m-5m" | "5m+" | null;
  migrationCleanupRequired?: boolean | null;
  externalIdpRequired?: boolean | null;
  workerIdpRequired?: boolean | null;
  idpDocumented?: boolean | null;
  includeB2c?: boolean | null;
  includeB2bPortal?: boolean | null;
  portalFormCountRange?: "1-3" | "4-10" | "11-25" | "26+" | null;
  compliance?: string[] | null;
}

/** Regimes that force a federal audit posture. */
const FEDERAL_AUDIT_REGIMES = ["fedramp_moderate", "fedramp_high", "cjis", "irs_1075"];

const DIFFICULTY_LEVEL: Record<string, ComplexityLevel> = {
  simple: "low",
  moderate: "medium",
  complex: "high",
  very_complex: "very_high",
};

const VOLUME_LEVEL: Record<string, ComplexityLevel> = {
  "<100k": "low",
  "100k-1m": "medium",
  "1m-5m": "high",
  "5m+": "very_high",
};

const FORM_COUNT_LEVEL: Record<string, ComplexityLevel> = {
  "1-3": "low",
  "4-10": "medium",
  "11-25": "high",
  "26+": "very_high",
};

const ORDER: ComplexityLevel[] = ["none", "low", "medium", "high", "very_high"];

/** Bump a level by one step, capped at very_high. */
function bump(level: ComplexityLevel): ComplexityLevel {
  const index = ORDER.indexOf(level);
  return ORDER[Math.min(index + 1, ORDER.length - 1)] as ComplexityLevel;
}

/** Integration driver: difficulty band, none when integrations are off. */
export function integrationComplexity(q: DriverQuoteInput): ComplexityLevel {
  if (!q.hasIntegrations) return "none";
  if (!q.integrationCount || q.integrationCount <= 0) return "none";
  return q.integrationDifficulty
    ? (DIFFICULTY_LEVEL[q.integrationDifficulty] as ComplexityLevel)
    : "low";
}

/** Migration driver: volume band, bumped one step when cleanup is required. */
export function migrationComplexity(q: DriverQuoteInput): ComplexityLevel {
  if (!q.migrationRequired) return "none";
  const base = q.migrationVolumeRange
    ? (VOLUME_LEVEL[q.migrationVolumeRange] as ComplexityLevel)
    : "low";
  return q.migrationCleanupRequired ? bump(base) : base;
}

/**
 * Identity driver: both audiences federated is high, one is medium (low when
 * the integration is already documented).
 */
export function identityComplexity(q: DriverQuoteInput): ComplexityLevel {
  const external = Boolean(q.externalIdpRequired);
  const worker = Boolean(q.workerIdpRequired);
  if (!external && !worker) return "none";
  if (external && worker) return q.idpDocumented ? "high" : "very_high";
  return q.idpDocumented ? "low" : "medium";
}

/**
 * Portal driver: derived from portal presence plus form count only.
 *
 * NOTE: the full v6 portal formula also weighs payments, e-signature and
 * multilingual/accessibility requirements. None of those are collected in the
 * intake form today, so they are treated as absent (false) rather than
 * guessed.
 */
export function portalComplexity(q: DriverQuoteInput): ComplexityLevel {
  const b2c = Boolean(q.includeB2c);
  const b2b = Boolean(q.includeB2bPortal);
  if (!b2c && !b2b) return "none";
  const base = q.portalFormCountRange
    ? (FORM_COUNT_LEVEL[q.portalFormCountRange] as ComplexityLevel)
    : "low";
  return b2c && b2b ? bump(base) : base;
}

/** Compliance driver: regime count, escalated by federal audit regimes. */
export function complianceComplexity(q: DriverQuoteInput): ComplexityLevel {
  const regimes = q.compliance ?? [];
  if (regimes.length === 0) return "none";
  const federal = regimes.some((r) => FEDERAL_AUDIT_REGIMES.includes(r));
  if (federal) return regimes.length >= 4 ? "very_high" : "high";
  if (regimes.length === 1) return "low";
  if (regimes.length === 2) return "medium";
  return "high";
}

export interface QuoteDriverMapping extends DriverLevels {
  /**
   * Confidence signal. `integrationDifficulty` is a difficulty scale, NOT a
   * documented/undocumented flag, so it never feeds this. Only `idpDocumented`
   * carries a real documentation signal today; when no IdP work is in scope
   * this stays false (unknown), never guessed true.
   */
  hasUndocumentedIntegration: boolean;
}

/** Map a Quote-shaped object onto the complexity driver levels. */
export function mapQuoteToDrivers(q: DriverQuoteInput): QuoteDriverMapping {
  const anyIdp = Boolean(q.externalIdpRequired) || Boolean(q.workerIdpRequired);
  return {
    integration: integrationComplexity(q),
    migration: migrationComplexity(q),
    identity: identityComplexity(q),
    portal: portalComplexity(q),
    compliance: complianceComplexity(q),
    hasUndocumentedIntegration: anyIdp ? q.idpDocumented === false : false,
  };
}
