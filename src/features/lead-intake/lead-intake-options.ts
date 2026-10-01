/**
 * Option lists for the public lead-intake form.
 *
 * `lead_intakes` stores these as free text / text[], so the values here are
 * the canonical slugs the internal scoring trigger expects.
 */

export const REGION_OPTIONS = [
  { value: "north_america", label: "North America" },
  { value: "latam", label: "Latin America" },
  { value: "emea", label: "Europe, Middle East & Africa" },
  { value: "apac", label: "Asia Pacific" },
  { value: "other", label: "Other / global" },
] as const;

export const HOSTING_PREFERENCES = [
  { value: "cloud", label: "Vendor-hosted cloud" },
  { value: "govcloud", label: "Government cloud (FedRAMP)" },
  { value: "customer_hosted", label: "Regular hosting (Free)" },
  { value: "unsure", label: "Not sure yet" },
] as const;

export const COMPLIANCE_OPTIONS = [
  { value: "soc2", label: "SOC 2" },
  { value: "hipaa", label: "HIPAA" },
  { value: "fedramp_moderate", label: "FedRAMP Moderate" },
  { value: "fedramp_high", label: "FedRAMP High" },
  { value: "cjis", label: "CJIS" },
  { value: "stateramp", label: "StateRAMP" },
  { value: "irs_1075", label: "IRS Pub. 1075" },
  { value: "none", label: "None / not sure" },
] as const;

export const INTEGRATION_DIFFICULTY = [
  { value: "low", label: "Simple — modern APIs" },
  { value: "medium", label: "Moderate — some legacy systems" },
  { value: "high", label: "Complex — mainframe or custom protocols" },
  { value: "unsure", label: "Not sure" },
] as const;

/**
 * Lead-side customer type. Deliberately coarser than the quote enum: a single
 * `state` value (no NASPO split) — conversion leaves the quote's customer type
 * null for state leads so the estimator decides. Never map `state` to a quote
 * value here.
 */
export const CUSTOMER_TYPE_OPTIONS = [
  { value: "state", label: "State agency" },
  { value: "federal", label: "Federal agency" },
  { value: "county", label: "County or city government" },
  { value: "tribal", label: "Tribal government" },
  { value: "commercial", label: "Private company" },
  { value: "unsure", label: "Not sure" },
] as const;

export type LeadCustomerType = (typeof CUSTOMER_TYPE_OPTIONS)[number]["value"];

/** Blank/whitespace (or unknown) → null; otherwise the exact stored slug. */
export function toLeadCustomerType(value: string | null | undefined): LeadCustomerType | null {
  const trimmed = (value ?? "").trim();
  return CUSTOMER_TYPE_OPTIONS.some((o) => o.value === trimmed)
    ? (trimmed as LeadCustomerType)
    : null;
}
