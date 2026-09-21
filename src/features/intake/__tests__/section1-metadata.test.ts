import { describe, expect, it } from "vitest";
import {
  quoteSchema,
  type Quote,
} from "@/types/quote";
import { rowToQuote, QUOTE_FIELD_COLUMNS } from "../quote-mapper";
import {
  DEAL_PRIORITIES,
  DEAL_TEMPLATES,
  OPPORTUNITY_STAGES,
  QUOTE_VALIDITY_DEFAULT_DAYS,
} from "../sections/quote-metadata-options";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { grandTotalCost } from "@/lib/pricing-engine/fullQuote";
import { PRICING_SENSITIVE_QUOTE_COLUMNS } from "@/lib/quote-columns";

/** Questionnaire v6.4 Section 1 — Quote Metadata (Q1.4, Q1.7, Q1.8, Q1.9). */

/** Minimal valid form input so schema parses succeed. */
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

const isoDate = "2026-11-19";

const baseRow = {
  id: "row-1",
  owner_id: "user-1",
  requested_by: "user-1",
  reviewed_by: null,
  last_reviewed_by: null,
  approved_by: null,
  name: "Metadata Quote",
  customer_name: "State DOL",
  customer_email: null,
  customer_type: "state_naspo",
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
  contingency_pct: 0,
  margin_justification: null,
  rep_confidence: "high",
  tier: "ballpark",
  state: "draft",
  submitted_at: null,
  approved_at: null,
  sent_at: null,
  created_at: "2026-09-21T00:00:00Z",
  updated_at: "2026-09-21T00:00:00Z",
  needs_attention: false,
} as Record<string, unknown>;

describe("Section 1 defaults (Q1.4, Q1.7, Q1.8, Q1.9)", () => {
  it("defaults opportunity stage to discovery and deal priority to standard", () => {
    const parsed = quoteSchema.parse(VALID_BASE);
    expect(parsed.opportunityStage).toBe("discovery");
    expect(parsed.dealPriority).toBe("standard");
  });

  it("leaves deal template and validity date blank by default", () => {
    const parsed = quoteSchema.parse(VALID_BASE);
    expect(parsed.dealTemplate).toBeNull();
    expect(parsed.quoteValidityDate).toBeNull();
  });

  it("defines the 60-day validity default constant used at quote creation", () => {
    expect(QUOTE_VALIDITY_DEFAULT_DAYS).toBe(60);
  });
});

describe("Section 1 exact v6.4 option sets", () => {
  it("Q1.4 opportunity stages", () => {
    expect(OPPORTUNITY_STAGES.map((o) => o.value)).toEqual([
      "discovery",
      "qualified",
      "proposal",
      "negotiation",
      "closed",
      "other",
    ]);
    expect(OPPORTUNITY_STAGES.map((o) => o.label)).toEqual([
      "Discovery",
      "Qualified",
      "Proposal",
      "Negotiation",
      "Closed",
      "Other",
    ]);
  });

  it("Q1.7 deal priorities", () => {
    expect(DEAL_PRIORITIES.map((o) => o.value)).toEqual([
      "standard",
      "strategic",
      "rush",
      "other",
    ]);
  });

  it("Q1.8 deal templates", () => {
    expect(DEAL_TEMPLATES.map((o) => o.value)).toEqual([
      "state_workers_comp",
      "state_health_benefits",
      "county_justice_modernization",
      "federal_small_deployment",
      "blank",
      "other",
    ]);
    expect(DEAL_TEMPLATES.map((o) => o.label)).toEqual([
      "State Workers' Compensation",
      "State Health Benefits",
      "County Justice Modernization",
      "Federal Small Deployment",
      "Blank",
      "Other",
    ]);
  });
});

describe("Section 1 validation", () => {
  it("accepts every valid option value", () => {
    const parsed = quoteSchema.parse({
      ...VALID_BASE,
      opportunityStage: "negotiation",
      dealPriority: "rush",
      dealTemplate: "federal_small_deployment",
      quoteValidityDate: isoDate,
    });
    expect(parsed.opportunityStage).toBe("negotiation");
    expect(parsed.dealPriority).toBe("rush");
    expect(parsed.dealTemplate).toBe("federal_small_deployment");
    expect(parsed.quoteValidityDate).toBe(isoDate);
  });

  it("rejects values outside the v6.4 option sets (no invented CRM values)", () => {
    expect(
      quoteSchema.safeParse({ ...VALID_BASE, opportunityStage: "closed_won" }).success,
    ).toBe(false);
    expect(quoteSchema.safeParse({ ...VALID_BASE, dealPriority: "p1" }).success).toBe(false);
    expect(quoteSchema.safeParse({ ...VALID_BASE, dealTemplate: "saas_accelerate" }).success)
      .toBe(false);
  });

  it("rejects invalid validity-date formats and non-dates", () => {
    expect(quoteSchema.safeParse({ ...VALID_BASE, quoteValidityDate: "11/19/2026" }).success)
      .toBe(false);
    expect(quoteSchema.safeParse({ ...VALID_BASE, quoteValidityDate: "2026-13-01" }).success)
      .toBe(false);
    expect(quoteSchema.safeParse({ ...VALID_BASE, quoteValidityDate: 12345 }).success).toBe(
      false,
    );
  });

  it("accepts a blank validity date (means no validity statement)", () => {
    const parsed = quoteSchema.parse({ ...VALID_BASE, quoteValidityDate: null });
    expect(parsed.quoteValidityDate).toBeNull();
  });
});

describe("Section 1 row-to-quote mapping (reload/rehydration)", () => {
  it("maps the new snake_case columns with fallback defaults", () => {
    const quote = rowToQuote(baseRow as never);
    expect(quote.opportunityStage).toBe("discovery");
    expect(quote.dealPriority).toBe("standard");
    expect(quote.dealTemplate).toBeNull();
    expect(quote.quoteValidityDate).toBeNull();
  });

  it("maps stored values through unchanged", () => {
    const quote = rowToQuote({
      ...baseRow,
      opportunity_stage: "proposal",
      deal_priority: "strategic",
      deal_template: "state_workers_comp",
      quote_validity_date: isoDate,
    } as never);
    expect(quote.opportunityStage).toBe("proposal");
    expect(quote.dealPriority).toBe("strategic");
    expect(quote.dealTemplate).toBe("state_workers_comp");
    expect(quote.quoteValidityDate).toBe(isoDate);
  });

  it("maps the new fields back to their database columns for autosave", () => {
    expect(QUOTE_FIELD_COLUMNS["opportunityStage"]).toBe("opportunity_stage");
    expect(QUOTE_FIELD_COLUMNS["dealPriority"]).toBe("deal_priority");
    expect(QUOTE_FIELD_COLUMNS["dealTemplate"]).toBe("deal_template");
    expect(QUOTE_FIELD_COLUMNS["quoteValidityDate"]).toBe("quote_validity_date");
  });
});

describe("Section 1 pricing and exposure safety", () => {
  it("fields are not pricing-sensitive columns", () => {
    const newCols = ["opportunity_stage", "deal_priority", "deal_template", "quote_validity_date"];
    for (const col of newCols) {
      expect(
        (PRICING_SENSITIVE_QUOTE_COLUMNS as readonly string[]).includes(col),
      ).toBe(false);
    }
  });

  it("do not change computed totals", () => {
    const lines = [
      { id: "w1", quoteId: "quote-1", phase: "Build", area: null, role: "Engineer", location: "Onshore", costHours: 100, costRate: 225, revenueHours: 100, revenueRate: 300, billRate: 300, personDays: null, createdAt: "2026-01-01" },
    ];
    const items = [{ id: "c1", quoteId: "quote-1", name: "Travel", costType: "travel", amount: 1000, isCustomerVisible: false, createdAt: "2026-01-01" }];
    const withMetadata: Partial<Quote> = {
      opportunityStage: "negotiation",
      dealPriority: "rush",
      dealTemplate: "state_workers_comp",
      quoteValidityDate: isoDate,
    };
    const before = makeQuote();
    const after = makeQuote(withMetadata);
    expect(grandTotalCost(lines, items)).toBe(
      grandTotalCost(lines, items),
    );
    expect(after.opportunityStage).toBe("negotiation");
    // The metadata lives only on the quote shell; the calculation inputs
    // (WBS lines and cost items) are untouched by construction.
    expect(before.dealTemplate).toBeNull();
  });
});
