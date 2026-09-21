/**
 * Section 1 (Quote Metadata) option lists.
 *
 * Labels and option sets come verbatim from Questionnaire v6.4 Q1.4, Q1.7 and
 * Q1.8. Stored values are snake_case identifiers; none of these fields feed
 * any pricing calculation.
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
