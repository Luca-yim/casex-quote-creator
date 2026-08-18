import type { Quote } from "@/types/quote";

/**
 * A contextual note surfaced to the user about a quote's pricing or
 * business assumptions. Assumptions are pure derivations from the quote
 * shape and contain no side effects.
 */
export interface Assumption {
  /** Stable identifier for React keys. */
  id: string;
  /** Human-readable note. */
  text: string;
  /** Visual tone used to render the assumption pill. */
  tone: "info" | "warning" | "success";
}

/**
 * Builds a list of contextual assumptions for a quote based on the
 * current field values. Each rule is evaluated independently and the
 * resulting assumptions are returned in a deterministic order.
 *
 * @param quote - The quote to derive assumptions from.
 * @returns An ordered array of assumptions.
 */
export function buildAssumptions(quote: Quote): Assumption[] {
  const assumptions: Assumption[] = [];

  if (quote.moduleTier === null) {
    assumptions.push({
      id: "module-tier-missing",
      tone: "warning",
      text: "Module tier not selected — baseline pricing incomplete",
    });
  }

  if (quote.repeatableActivation === "full_match") {
    assumptions.push({
      id: "repeatability-full",
      tone: "success",
      text: "10% baseline reduction applied for full solution match",
    });
  }

  if (quote.repeatableActivation === "partial_match") {
    assumptions.push({
      id: "repeatability-partial",
      tone: "success",
      text: "5% baseline reduction applied for partial solution match",
    });
  }

  if (quote.repeatableActivation === "novel") {
    assumptions.push({
      id: "repeatability-novel",
      tone: "info",
      text: "Novel solution — no repeatability adjustment",
    });
  }

  const complianceRequiringFedRamp = ["fedramp_high", "cjis", "irs_1075"] as const;
  if (
    quote.compliance.some((c) =>
      complianceRequiringFedRamp.includes(c as (typeof complianceRequiringFedRamp)[number])
    )
  ) {
    assumptions.push({
      id: "compliance-fedramp",
      tone: "info",
      text: "Compliance requires FedRAMP hosting and onshore delivery",
    });
  }

  if ((quote.caseWorkerCount ?? 0) > 1500) {
    assumptions.push({
      id: "caseworker-tier-exceeded",
      tone: "warning",
      text: "Case worker count exceeds Tier 3 max (1500) — custom pricing required",
    });
  }

  if (quote.contractYears < 3) {
    assumptions.push({
      id: "short-term",
      tone: "warning",
      text: "Contract term under 3 years — may require executive approval",
    });
  }

  if (quote.contractYears >= 5) {
    assumptions.push({
      id: "multi-year",
      tone: "success",
      text: "Multi-year commitment — favorable margin",
    });
  }

  if (quote.repConfidence === "low") {
    assumptions.push({
      id: "low-confidence",
      tone: "warning",
      text: "Rep confidence is low — expect estimator scrutiny",
    });
  }

  if (quote.hasIntegrations && quote.integrationCount > 5) {
    assumptions.push({
      id: "high-integrations",
      tone: "info",
      text: "Integration count is high — timeline may extend",
    });
  }

  if (quote.hostingModel === "customer_hosted") {
    assumptions.push({
      id: "customer-hosted",
      tone: "info",
      text: "Customer-hosted deployment — no monthly hosting fee",
    });
  }

  return assumptions;
}
