import type { Quote } from "@/types/quote";

/**
 * Section 1 (Quote Metadata) and Section 2 (Proposal-only) option lists.
 *
 * Labels and option sets come verbatim from Questionnaire v6.4 (Q1.4, Q1.7,
 * Q1.8, Q2.2, Q2.3). Stored values are snake_case identifiers; none of these
 * fields feed any pricing calculation.
 */

export const OPPORTUNITY_STAGES = [
  { value: "discovery", label: "Discovery" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed", label: "Closed" },
  { value: "other", label: "Other" },
] as const;

export const DEAL_PRIORITIES = [
  { value: "standard", label: "Standard" },
  { value: "strategic", label: "Strategic" },
  { value: "rush", label: "Rush" },
  { value: "other", label: "Other" },
] as const;

export const DEAL_TEMPLATES = [
  { value: "state_workers_comp", label: "State Workers' Compensation" },
  { value: "state_health_benefits", label: "State Health Benefits" },
  { value: "county_justice_modernization", label: "County Justice Modernization" },
  { value: "federal_small_deployment", label: "Federal Small Deployment" },
  { value: "blank", label: "Blank" },
  { value: "other", label: "Other" },
] as const;

/** Q1.9 — new quotes start with a 60-day validity window. */
export const QUOTE_VALIDITY_DEFAULT_DAYS = 60;

// ============= Section 2 (Proposal-only) =============

/**
 * Q2.2 — Geographic Scope. Exact v6.4 option set. Proposal-only: describes
 * engagement/procurement breadth, NOT world geography, and is therefore
 * never mapped from the public lead's `region` field.
 */
export const GEOGRAPHIC_SCOPES = [
  { value: "single_agency", label: "Single agency" },
  { value: "multi_agency_same_state", label: "Multi-agency (same state)" },
  { value: "multi_state", label: "Multi-state" },
  { value: "national", label: "National" },
  { value: "other", label: "Other" },
] as const;

/**
 * Q2.3 — Pricing Schedule. Exact v6.4 stored values. This is an explicit
 * Proposal selection declaring the commercial price basis. It is metadata
 * only in this slice: selecting any value does not alter calculations.
 */
export const PRICING_SCHEDULES = [
  { value: "naspo", label: "NASPO cooperative pricing" },
  { value: "list", label: "List pricing" },
  { value: "custom", label: "Custom" },
  { value: "other", label: "Other" },
] as const;

/**
 * Application/UI default for Q2.3 — preselect NASPO cooperative pricing for
 * NASPO customers, list pricing otherwise. The stored value must always be
 * explicit; there is deliberately no database default.
 */
export function pricingScheduleDefaultFor(
  customerType: Quote["customerType"],
): "naspo" | "list" {
  return customerType === "state_naspo" ? "naspo" : "list";
}

