import type { PricingCatalogRow } from "@/types/pricing";
import type { Quote } from "@/types/quote";

/** Helper to build a catalog row with sensible defaults. */
function row(
  sku_id: string,
  name: string,
  category: PricingCatalogRow["category"],
  unit_price: number,
  unit_type: PricingCatalogRow["unit_type"],
  tier_range: [number, number] | null = null,
): PricingCatalogRow {
  return {
    sku_id,
    name,
    category,
    unit_price,
    unit_type,
    tier_range,
    effective_date: "2026-01-01",
    expiration_date: null,
    metadata: {},
  };
}

/** Deterministic catalog mirroring the Supabase `pricing_catalog` seed data. */
export const TEST_CATALOG: PricingCatalogRow[] = [
  row("module_standard", "Standard Module", "one_time", 735000, "flat"),
  row("module_enterprise", "Enterprise Module", "one_time", 975000, "flat"),
  row("cw_tier1", "Case Worker Tier 1", "monthly", 97.9, "per_user", [1, 500]),
  row("cw_tier2", "Case Worker Tier 2", "monthly", 83.6, "per_user", [501, 1000]),
  row("cw_tier3", "Case Worker Tier 3", "monthly", 56.1, "per_user", [1001, 1500]),
  row("b2c_pack1", "B2C Portal — up to 1K MAU", "monthly", 833, "flat", [1, 1000]),
  row("b2c_pack2", "B2C Portal — 1K–10K MAU", "monthly", 1667, "flat", [1001, 10000]),
  row("b2c_pack3", "B2C Portal — 10K–50K MAU", "monthly", 4167, "flat", [10001, 50000]),
  row("b2c_pack4", "B2C Portal — 50K–100K MAU", "monthly", 6250, "flat", [50001, 100000]),
  row("b2c_pack5", "B2C Portal — 100K–200K MAU", "monthly", 8333, "flat", [100001, 200000]),
  row("b2b_user", "B2B Portal User", "monthly", 15, "per_user"),
  row("hosting_soc2", "SOC-2 Hosting", "monthly", 2025, "per_instance"),
  row("hosting_fedramp", "FedRAMP Hosting", "monthly", 5025, "per_instance"),
  row("support_standard", "Standard Support", "monthly", 10000, "flat"),
  row("support_enhanced", "Enhanced Support", "monthly", 17000, "flat"),
  row("support_premium", "Premium Support", "monthly", 45000, "flat"),
];

/** Builds a valid `Quote` with sensible defaults, applying any overrides. */
export function makeQuote(overrides: Partial<Quote> = {}): Quote {
  const base: Quote = {
    id: "quote-1",
    ownerId: "user-1",
    requestedBy: "user-1",
    reviewedBy: null,
    lastReviewedBy: null,
    approvedBy: null,
    name: "Test Quote",
    customerName: "Test Customer",
    customerEmail: "customer@example.gov",
    customerType: "state_naspo",
    compliance: [],
    vertical: "Health & Human Services",
    solution: "Eligibility Case Management",
    repeatableActivation: "novel",
    moduleTier: "standard",
    contractYears: 3,
    targetGoLiveDate: null,
    caseWorkerCount: 100,
    includeB2c: false,
    b2cMau: null,
    includeB2bPortal: false,
    b2bUserCount: null,
    hostingModel: "soc2",
    environmentCount: 3,
    hasIntegrations: false,
    integrationCount: 0,
    integrationDifficulty: null,
    supportTier: "standard",
    marginPercent: 20,
    marginJustification: null,
    repConfidence: "medium",
    tier: "ballpark",
    state: "draft",
    submittedAt: null,
    approvedAt: null,
    sentAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return { ...base, ...overrides };
}

/** Builds an essentially empty draft quote (all optional fields null/false). */
export function makeEmptyQuote(overrides: Partial<Quote> = {}): Quote {
  return makeQuote({
    name: "",
    customerName: null,
    customerEmail: null,
    customerType: null,
    vertical: null,
    solution: null,
    moduleTier: null,
    hostingModel: null,
    supportTier: null,
    caseWorkerCount: null,
    contractYears: Number.NaN,
    repConfidence: null,
    ...overrides,
  });
}
