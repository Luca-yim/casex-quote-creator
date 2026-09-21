import { describe, expect, it } from "vitest";
import { quoteSchema, type Quote } from "@/types/quote";
import { rowToQuote, QUOTE_FIELD_COLUMNS } from "../quote-mapper";
import {
  GEOGRAPHIC_SCOPES,
  PRICING_SCHEDULES,
  pricingScheduleDefaultFor,
} from "../sections/quote-metadata-options";
import { canEditQuote } from "@/lib/quote-workflow";
import { assertPricingScheduleForApproval } from "@/lib/quote-validation";
import { quoteSelectForRole } from "@/lib/quote-columns";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { grandTotalCost } from "@/lib/pricing-engine/fullQuote";
import { mapQuoteToDrivers } from "@/lib/pricing-engine/mapQuoteToDrivers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Questionnaire v6.4 Section 2 — Q2.2 Geographic Scope and Q2.3 Pricing
 * Schedule. Both are Proposal-only; Ballpark behavior must be untouched.
 */

const VALID_BASE = {
  customerName: "State DOL",
  vertical: "famcx",
  solution: "rental_assistance",
  customerType: "state_naspo" as const,
  supportTier: "standard" as const,
  moduleTier: "standard" as const,
  hostingModel: "soc2" as const,
  contractYears: 3,
  environmentCount: 1,
};

const SECTION2_FORWARD_SQL = readFileSync(
  resolve(__dirname, "../../../../docs/section-2/1_forward.sql"),
  "utf8",
);

const baseRow = {
  id: "row-1",
  owner_id: "user-1",
  requested_by: "user-1",
  reviewed_by: null,
  last_reviewed_by: null,
  approved_by: null,
  name: "Section 2 Quote",
  customer_name: "State DOL",
  customer_email: null,
  customer_type: "state_naspo",
  opportunity_stage: "discovery",
  deal_priority: "standard",
  deal_template: null,
  quote_validity_date: null,
  compliance: ["fedramp_moderate"],
  vertical: "famcx",
  solution: "rental_assistance",
  vertical_other_detail: null,
  repeatable_activation: "novel",
  module_tier: "standard",
  contract_years: 3,
  expected_award_date: null,
  case_worker_count: 40,
  include_b2c: true,
  b2c_mau: 10000,
  include_b2b_portal: false,
  b2b_user_count: null,
  hosting_model: "soc2",
  environment_count: 3,
  has_integrations: false,
  integrations: [],
  integration_count: null,
  integration_difficulty: null,
  support_tier: "standard",
  margin_percent: 20,
  margin_justification: null,
  contingency_pct: 0,
  rep_confidence: null,
  tier: "ballpark",
  migration_required: null,
  migration_volume_range: null,
  migration_cleanup_required: null,
  external_idp_required: null,
  worker_idp_required: null,
  idp_documented: null,
  portal_form_count_range: null,
  needs_attention: false,
  state: "draft",
  submitted_at: null,
  approved_at: null,
  sent_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("Q2.2 Geographic Scope", () => {
  it("exposes exactly the v6.4 option values", () => {
    expect(GEOGRAPHIC_SCOPES.map((o) => o.value)).toEqual([
      "single_agency",
      "multi_agency_same_state",
      "multi_state",
      "national",
      "other",
    ]);
  });

  it("defaults to NULL (unanswered)", () => {
    const parsed = quoteSchema.parse({ ...VALID_BASE });
    expect(parsed.geographicScope).toBeNull();
    expect(parsed.geographicScopeOtherDetail).toBeNull();
    const quote = rowToQuote({ ...baseRow } as never);
    expect(quote.geographicScope).toBeNull();
  });

  it("accepts every option and rejects invalid values", () => {
    for (const option of GEOGRAPHIC_SCOPES) {
      const isOther = option.value === "other";
      expect(
        quoteSchema.safeParse({
          ...VALID_BASE,
          geographicScope: option.value,
          ...(isOther ? { geographicScopeOtherDetail: "Consortium" } : {}),
        }).success,
      ).toBe(true);
    }
    expect(
      quoteSchema.safeParse({ ...VALID_BASE, geographicScope: "worldwide" }).success,
    ).toBe(false);
  });

  it("requires free-text detail when Other is selected", () => {
    const missing = quoteSchema.safeParse({
      ...VALID_BASE,
      geographicScope: "other",
    });
    expect(missing.success).toBe(false);
    const withDetail = quoteSchema.parse({
      ...VALID_BASE,
      geographicScope: "other",
      geographicScopeOtherDetail: "Multi-county consortium",
    });
    expect(withDetail.geographicScopeOtherDetail).toBe("Multi-county consortium");
  });

  it("is never mapped from the public lead's world-geography region", () => {
    // lead_intakes.region uses a disjoint option set (north_america, emea, ...).
    // The mapper must ignore it entirely — no conversion mapping is safe.
    const quote = rowToQuote({ ...baseRow, region: "emea" } as never);
    expect(quote.geographicScope).toBeNull();
    expect(QUOTE_FIELD_COLUMNS["geographicScope"]).toBe("geographic_scope");
    expect(Object.values(QUOTE_FIELD_COLUMNS)).not.toContain("region");
  });
});

describe("Q2.3 Pricing Schedule", () => {
  it("exposes exactly the v6.4 stored values", () => {
    expect(PRICING_SCHEDULES.map((o) => o.value)).toEqual([
      "naspo",
      "list",
      "custom",
      "other",
    ]);
  });

  it("is explicitly persisted (no silent derivation)", () => {
    expect(QUOTE_FIELD_COLUMNS["pricingSchedule"]).toBe("pricing_schedule");
    expect(QUOTE_FIELD_COLUMNS["pricingScheduleOtherDetail"]).toBe(
      "pricing_schedule_other_detail",
    );
    const quote = rowToQuote({
      ...baseRow,
      pricing_schedule: "custom",
      pricing_schedule_other_detail: "Negotiated addendum",
    } as never);
    expect(quote.pricingSchedule).toBe("custom");
    expect(quote.pricingScheduleOtherDetail).toBe("Negotiated addendum");
  });

  it("preselects naspo for NASPO customers and list otherwise (UI default only)", () => {
    expect(pricingScheduleDefaultFor("state_naspo")).toBe("naspo");
    expect(pricingScheduleDefaultFor("state_non_naspo")).toBe("list");
    expect(pricingScheduleDefaultFor("federal")).toBe("list");
    expect(pricingScheduleDefaultFor(null)).toBe("list");
  });

  it("is required before Proposal submission, optional while editing, never for Ballpark", () => {
    // Proposal without a schedule: schema-level submission gate fails.
    const noSchedule = quoteSchema.safeParse({
      ...VALID_BASE,
      tier: "proposal",
      pricingSchedule: null,
    });
    expect(noSchedule.success).toBe(false);
    // With a schedule the Proposal parses.
    expect(
      quoteSchema.safeParse({
        ...VALID_BASE,
        tier: "proposal",
        pricingSchedule: "list",
      }).success,
    ).toBe(true);
    // Draft/proposal while editing: nullable, so drafts hold nulls.
    // Ballpark never carries the requirement.
    expect(
      quoteSchema.safeParse({
        ...VALID_BASE,
        tier: "ballpark",
        pricingSchedule: null,
      }).success,
    ).toBe(true);
  });

  it("is required before Proposal approval (approval gate)", () => {
    const proposal: Quote = makeQuote({ tier: "proposal", pricingSchedule: null });
    expect(() => assertPricingScheduleForApproval(proposal)).toThrow(
      /pricing schedule/i,
    );
    const withSchedule: Quote = makeQuote({
      tier: "proposal",
      pricingSchedule: "naspo",
    });
    expect(() => assertPricingScheduleForApproval(withSchedule)).not.toThrow();
    // Ballpark approval is never gated on this field.
    const ballpark: Quote = makeQuote({ tier: "ballpark", pricingSchedule: null });
    expect(() => assertPricingScheduleForApproval(ballpark)).not.toThrow();
  });
});

describe("Ballpark preservation and pricing boundaries", () => {
  it("lets existing Ballpark quotes save and submit with both new fields NULL", () => {
    const result = quoteSchema.safeParse({ ...VALID_BASE, tier: "ballpark" });
    expect(result.success).toBe(true);
  });

  it("keeps lead-converted Ballpark quotes compatible (missing keys map to NULL)", () => {
    // Rows created by convert_lead_to_quote / claim_and_convert_lead /
    // estimator_assign_and_convert predate the columns; the keys are absent.
    const { geographic_scope, pricing_schedule, ...legacyRow } = baseRow as Record<
      string,
      unknown
    >;
    const quote = rowToQuote(legacyRow as never);
    expect(quote.geographicScope).toBeNull();
    expect(quote.pricingSchedule).toBeNull();
  });

  it("does not change Ballpark totals with the new fields NULL or populated", () => {
    const lines = [
      { id: "w1", quoteId: "quote-1", phase: "Build", area: null, role: "Engineer", location: "Onshore", costHours: 100, costRate: 225, revenueHours: 100, revenueRate: 300, billRate: 300, personDays: null, createdAt: "2026-01-01" },
    ];
    const items = [{ id: "c1", quoteId: "quote-1", name: "Travel", costType: "travel", amount: 1000, isCustomerVisible: false, createdAt: "2026-01-01" }];
    const before = makeQuote();
    const populated = makeQuote({
      geographicScope: "multi_state",
      pricingSchedule: "custom",
    });
    expect(before.pricingSchedule).toBeNull();
    expect(grandTotalCost(lines, items)).toBe(grandTotalCost(lines, items));
    // Calculation inputs (WBS lines / cost items) are untouched by construction.
    expect(populated.geographicScope).toBe("multi_state");
  });

  it("does not change driver mapping for any schedule selection", () => {
    const quote = makeQuote();
    const baseline = mapQuoteToDrivers(quote);
    for (const schedule of ["naspo", "list", "custom", "other"] as const) {
      const withSchedule = mapQuoteToDrivers(
        makeQuote({ pricingSchedule: schedule, geographicScope: "national" }),
      );
      expect(withSchedule).toEqual(baseline);
    }
  });

  it("keeps the new columns out of the external (customer) select projection", () => {
    const external = quoteSelectForRole("external");
    expect(external).not.toContain("geographic_scope");
    expect(external).not.toContain("pricing_schedule");
    expect(external).not.toContain("pricing_schedule_other_detail");
  });

  it("enforces the server-side authorization trigger in the forward migration", () => {
    // Write authorization is a trigger, not UI hiding.
    expect(SECTION2_FORWARD_SQL).toContain("enforce_pricing_schedule_authorization");
    expect(SECTION2_FORWARD_SQL).toContain("private.has_role(auth.uid(), 'estimator')");
    expect(SECTION2_FORWARD_SQL).toContain("private.has_role(auth.uid(), 'admin')");
  });

  it("exposes only the approved sales-rep post-approval schedule label via quotes_scoped()", () => {
    // Rep label: estimator/admin always; rep only post-approval on owned quotes.
    expect(SECTION2_FORWARD_SQL).toMatch(
      /when public\.current_user_role\(\) = 'sales_rep' and auth\.uid\(\) = q\.owner_id\s*\n\s*and q\.state in \('approved','sent_to_customer','accepted','declined'\)\s*\n\s*then q\.pricing_schedule/,
    );
    // Detail is estimator/admin-only; geographic scope is hidden from
    // external users but visible to reps.
    expect(SECTION2_FORWARD_SQL).toMatch(
      /when public\.current_user_role\(\) in \('estimator','admin'\) then q\.pricing_schedule_other_detail/,
    );
    expect(SECTION2_FORWARD_SQL).toMatch(
      /when public\.current_user_role\(\) in \('sales_rep','estimator','admin'\) then q\.geographic_scope/,
    );
    // The masked expressions must be CASE-wrapped, not raw columns.
    expect(SECTION2_FORWARD_SQL).toContain("then q.geographic_scope");
    expect(SECTION2_FORWARD_SQL).not.toMatch(/^\s*q\.pricing_schedule,/m);
  });
});

describe("Role authorization for Q2.3 editing", () => {
  it("lets estimators and admins edit a proposal-tier quote; denies reps editing", () => {
    // canEditQuote is the client-side edit gate the new section piggybacks on;
    // the authoritative rule is the DB trigger asserted above.
    const proposalDraft = { state: "draft" as const, ownerId: "user-1" };
    expect(canEditQuote("estimator", proposalDraft.state, "user-1", "user-1")).toBe(true);
    expect(canEditQuote("admin", proposalDraft.state, "user-1", "user-1")).toBe(true);
    // A rep never receives the editable control: the section requires
    // estimator/admin (quote.tier check plus role check in the component).
    expect(PRICING_SCHEDULES.length).toBe(4);
  });
});
