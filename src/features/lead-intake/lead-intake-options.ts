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
  { value: "customer_hosted", label: "We host it ourselves" },
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

export const INTEGRATION_COUNT_RANGES = [
  { value: "1-2", label: "1 – 2" },
  { value: "3-5", label: "3 – 5" },
  { value: "6-10", label: "6 – 10" },
  { value: "10+", label: "More than 10" },
] as const;

export const INTEGRATION_DIFFICULTY = [
  { value: "low", label: "Simple — modern APIs" },
  { value: "medium", label: "Moderate — some legacy systems" },
  { value: "high", label: "Complex — mainframe or custom protocols" },
  { value: "unsure", label: "Not sure" },
] as const;
