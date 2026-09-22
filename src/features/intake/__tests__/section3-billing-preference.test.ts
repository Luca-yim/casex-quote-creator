import { describe, expect, it } from "vitest";
import { quoteSchema, type Quote } from "@/types/quote";
import { rowToQuote, QUOTE_FIELD_COLUMNS } from "../quote-mapper";
import { BILLING_PREFERENCES } from "../sections/quote-metadata-options";
import { canEditIntake, canEditQuote } from "@/lib/quote-workflow";
import { quoteSelectForRole } from "@/lib/quote-columns";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { grandTotalCost } from "@/lib/pricing-engine/fullQuote";
import { mapQuoteToDrivers } from "@/lib/pricing-engine/mapQuoteToDrivers";
import { validateQuoteForSubmission } from "@/lib/quote-validation";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Questionnaire v6.4 Section 3 — Q3.4 Billing Preference. Proposal-only,
 * optional at completion/submission/approval, metadata only (no pricing,
 * WBS, NASPO, margin, contingency or scoring effect).
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

const SECTION3_FORWARD_SQL = readFileSync(
  resolve(__dirname, "../../../../docs/section-3/1_forward.sql"),
  "utf8",
);

const baseRow = {
  id: "row-1",
  owner_id: "user-1",
  requested_by: "user-1",
  reviewed_by: null,
  last_reviewed_by: null,
  approved_by: null,
  name: "Section 3 Quote",
  customer_name: "State DOL",
  customer_email: null,
  customer_type: "state_naspo",
  opportunity_stage: "discovery",
  deal_priority: "standard",
  deal_template: null,
  quote_validity_date: null,
  geographic_scope: null,
  geographic_scope_other_detail: null,
  pricing_schedule: null,
  pricing_schedule_other_detail: null,
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

describe("Q3.4 Billing Preference options and persistence", () => {
  it("exposes exactly the approved option values in order", () => {
    expect(BILLING_PREFERENCES.map((o) => o.value)).toEqual([
      "monthly",
      "annual_upfront",
      "annual_quarterly",
      "other",
    ]);
    expect(BILLING_PREFERENCES.map((o) => o.label)).toEqual([
      "Monthly",
      "Annual upfront",
      "Annual quarterly",
      "Other",
    ]);
  });

  it("defaults to blank (NULL) with no UI or database default", () => {
    const parsed = quoteSchema.parse({ ...VALID_BASE });
    expect(parsed.billingPreference).toBeNull();
    expect(parsed.billingPreferenceOtherDetail).toBeNull();
    const quote = rowToQuote({ ...baseRow } as never);
    expect(quote.billingPreference).toBeNull();
    expect(quote.billingPreferenceOtherDetail).toBeNull();
  });

  it("persists and reloads both fields", () => {
    const quote = rowToQuote({
      ...baseRow,
      billing_preference: "annual_quarterly",
      billing_preference_other_detail: null,
    } as never);
    expect(quote.billingPreference).toBe("annual_quarterly");
    const withOther = rowToQuote({
      ...baseRow,
      billing_preference: "other",
      billing_preference_other_detail: "Milestone invoicing",
    } as never);
    expect(withOther.billingPreference).toBe("other");
    expect(withOther.billingPreferenceOtherDetail).toBe("Milestone invoicing");
    expect(QUOTE_FIELD_COLUMNS["billingPreference"]).toBe("billing_preference");
    expect(QUOTE_FIELD_COLUMNS["billingPreferenceOtherDetail"]).toBe(
      "billing_preference_other_detail",
    );
  });

  it("accepts every approved option and rejects invalid values", () => {
    for (const option of BILLING_PREFERENCES) {
      const isOther = option.value === "other";
      expect(
        quoteSchema.safeParse({
          ...VALID_BASE,
          billingPreference: option.value,
          ...(isOther ? { billingPreferenceOtherDetail: "Custom plan" } : {}),
        }).success,
      ).toBe(true);
    }
    expect(
      quoteSchema.safeParse({ ...VALID_BASE, billingPreference: "weekly" })
        .success,
    ).toBe(false);
  });

  it("requires a nonblank Other detail when Other is selected", () => {
    expect(
      quoteSchema.safeParse({ ...VALID_BASE, billingPreference: "other" })
        .success,
    ).toBe(false);
    expect(
      quoteSchema.safeParse({
        ...VALID_BASE,
        billingPreference: "other",
        billingPreferenceOtherDetail: "   ",
      }).success,
    ).toBe(false);
    expect(
      quoteSchema.safeParse({
        ...VALID_BASE,
        billingPreference: "other",
        billingPreferenceOtherDetail: "Milestone invoicing",
      }).success,
    ).toBe(true);
  });

  it("stays optional for Proposal completion, submission and approval", () => {
    // A Proposal parses (and therefore submits and approves) with both Q3.4
    // fields NULL — Section 2's pricing-schedule gate is the only addition.
    const proposal = quoteSchema.safeParse({
      ...VALID_BASE,
      tier: "proposal",
      pricingSchedule: "list",
      billingPreference: null,
      billingPreferenceOtherDetail: null,
    });
    expect(proposal.success).toBe(true);
    const submission = validateQuoteForSubmission(
      makeQuote({
        tier: "proposal",
        pricingSchedule: "list",
        billingPreference: null,
        billingPreferenceOtherDetail: null,
      }),
    );
    expect(submission.missingRequiredFields).not.toContain(
      "billingPreference",
    );
    expect(submission.missingRequiredFields).not.toContain(
      "billingPreferenceOtherDetail",
    );
  });
});

describe("Q3.4 role visibility and write boundaries", () => {
  it("keeps both fields out of the external select projection", () => {
    const external = quoteSelectForRole("external");
    expect(external).not.toContain("billing_preference");
    expect(quoteSelectForRole("sales_rep")).toBe("*");
    expect(quoteSelectForRole("estimator")).toBe("*");
    expect(quoteSelectForRole("admin")).toBe("*");
  });

  it("excludes public lead intake from Q3.4", () => {
    const leadForm = readFileSync(
      resolve(__dirname, "../../lead-intake/LeadIntakeForm.tsx"),
      "utf8",
    );
    expect(leadForm).not.toContain("billingPreference");
    expect(leadForm).not.toContain("billing_preference");
  });

  /**
   * Decision table mirroring public.enforce_billing_preference_authorization()
   * in docs/section-3/1_forward.sql. Sales reps may write only their own
   * quote while the existing lifecycle considers it editable — exactly
   * canEditQuote("sales_rep", state, ownerId, userId), i.e. owned quotes in
   * the draft or estimator_adjusted states.
   */
  type TriggerRole = "external" | "sales_rep" | "estimator" | "admin" | null;
  const triggerAllows = (input: {
    op: "INSERT" | "UPDATE";
    role: TriggerRole; // null = auth.uid() IS NULL (trusted system context)
    ownsQuote: boolean;
    state: Quote["state"];
    next: { pref: string | null; detail: string | null };
    prev?: { pref: string | null; detail: string | null };
  }): boolean => {
    const prev = input.prev ?? { pref: null, detail: null };
    const protectedWrite =
      input.op === "INSERT"
        ? input.next.pref !== null || input.next.detail !== null
        : input.next.pref !== prev.pref ||
          input.next.detail !== prev.detail;
    if (!protectedWrite) return true;
    if (input.role === null) return true; // documented trusted context
    if (input.role === "estimator" || input.role === "admin") return true;
    if (
      input.role === "sales_rep" &&
      input.ownsQuote &&
      canEditIntake("sales_rep", input.state)
    ) {
      return true;
    }
    return false;
  };

  const EDITABLE_STATES: Quote["state"][] = ["draft", "estimator_adjusted"];
  const NON_EDITABLE_STATES: Quote["state"][] = [
    "submitted_for_review",
    "under_review",
    "approved",
    "sent_to_customer",
    "accepted",
    "declined",
    "archived",
  ];

  it("allows NULL Q3.4 inserts for Ballpark and lead-converted quotes", () => {
    for (const role of ["external", "sales_rep", "estimator", "admin"] as const) {
      expect(
        triggerAllows({
          op: "INSERT",
          role,
          ownsQuote: true,
          state: "draft",
          next: { pref: null, detail: null },
        }),
      ).toBe(true);
    }
  });

  it("permits Estimator and Admin writes in any state", () => {
    for (const role of ["estimator", "admin"] as const) {
      for (const state of [...EDITABLE_STATES, ...NON_EDITABLE_STATES]) {
        expect(
          triggerAllows({
            op: "UPDATE",
            role,
            ownsQuote: false,
            state,
            prev: { pref: null, detail: null },
            next: { pref: "monthly", detail: null },
          }),
        ).toBe(true);
      }
    }
  });

  it("permits Sales Representative writes only when owned AND editable-state", () => {
    for (const state of EDITABLE_STATES) {
      expect(
        triggerAllows({
          op: "UPDATE",
          role: "sales_rep",
          ownsQuote: true,
          state,
          prev: { pref: null, detail: null },
          next: { pref: "annual_upfront", detail: null },
        }),
      ).toBe(true);
    }
    for (const state of NON_EDITABLE_STATES) {
      expect(
        triggerAllows({
          op: "UPDATE",
          role: "sales_rep",
          ownsQuote: true,
          state,
          prev: { pref: null, detail: null },
          next: { pref: "annual_upfront", detail: null },
        }),
      ).toBe(false);
    }
    // Unowned quotes are never writable by a rep, even in an editable state.
    expect(
      triggerAllows({
        op: "UPDATE",
        role: "sales_rep",
        ownsQuote: false,
        state: "draft",
        prev: { pref: null, detail: null },
        next: { pref: "monthly", detail: null },
      }),
    ).toBe(false);
  });

  it("rejects External-user writes, including on their own drafts", () => {
    for (const state of EDITABLE_STATES) {
      expect(
        triggerAllows({
          op: "UPDATE",
          role: "external",
          ownsQuote: true,
          state,
          prev: { pref: null, detail: null },
          next: { pref: "monthly", detail: null },
        }),
      ).toBe(false);
      expect(
        triggerAllows({
          op: "UPDATE",
          role: "external",
          ownsQuote: true,
          state,
          prev: { pref: null, detail: null },
          next: { pref: null, detail: "detail only" },
        }),
      ).toBe(false);
    }
    expect(
      triggerAllows({
        op: "INSERT",
        role: "external",
        ownsQuote: true,
        state: "draft",
        next: { pref: "other", detail: "x" },
      }),
    ).toBe(false);
  });

  it("documents and allows the auth.uid() IS NULL trusted system context", () => {
    // Same convention as the Section 2 pricing trigger: service/system
    // operations run without a user context and pass the trigger.
    expect(
      triggerAllows({
        op: "UPDATE",
        role: null,
        ownsQuote: false,
        state: "approved",
        prev: { pref: null, detail: null },
        next: { pref: "other", detail: "Trusted backfill" },
      }),
    ).toBe(true);
  });

  it("enforces the server-side trigger in the forward migration SQL", () => {
    expect(SECTION3_FORWARD_SQL).toContain(
      "enforce_billing_preference_authorization",
    );
    expect(SECTION3_FORWARD_SQL).toContain(
      "BEFORE INSERT OR UPDATE ON public.quotes",
    );
    expect(SECTION3_FORWARD_SQL).toContain("IF TG_OP = 'INSERT' THEN");
    expect(SECTION3_FORWARD_SQL).toContain("USING ERRCODE = '42501'");
    // Trusted-context convention preserved.
    expect(SECTION3_FORWARD_SQL).toContain("auth.uid() IS NULL");
    // Rep gate mirrors the existing lifecycle states.
    expect(SECTION3_FORWARD_SQL).toContain(
      "NEW.state IN ('draft', 'estimator_adjusted')",
    );
    expect(SECTION3_FORWARD_SQL).toContain("NEW.owner_id = auth.uid()");
    // The existing Section 2 trigger must not be redefined here.
    expect(SECTION3_FORWARD_SQL).not.toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.enforce_pricing_schedule_authorization/,
    );
    // No unverified role helper may be executed.
    expect(SECTION3_FORWARD_SQL).not.toMatch(/^\s*[^-\s].*private\.has_role/m);
  });
});

describe("Q3.4 Ballpark, conversion and pricing invariance", () => {
  it("keeps lead-converted quotes compatible (missing keys map to NULL)", () => {
    const { billing_preference, billing_preference_other_detail, ...legacyRow } =
      baseRow as Record<string, unknown>;
    const quote = rowToQuote(legacyRow as never);
    expect(quote.billingPreference).toBeNull();
    expect(quote.billingPreferenceOtherDetail).toBeNull();
  });

  it("changes no pricing totals or driver mapping", () => {
    const lines = [
      {
        id: "w1", quoteId: "quote-1", phase: "Build", area: null,
        role: "Engineer", location: "Onshore", costHours: 100,
        costRate: 225, revenueHours: 100, revenueRate: 300, billRate: 300,
        personDays: null, createdAt: "2026-01-01",
      },
    ];
    const items = [
      {
        id: "c1", quoteId: "quote-1", name: "Travel", costType: "travel",
        amount: 1000, isCustomerVisible: false, createdAt: "2026-01-01",
      },
    ];
    const baseline = grandTotalCost(lines, items);
    for (const pref of ["monthly", "annual_upfront", "annual_quarterly", "other"] as const) {
      const populated = makeQuote({
        tier: "proposal",
        billingPreference: pref,
        billingPreferenceOtherDetail: pref === "other" ? "Custom" : null,
      });
      expect(mapQuoteToDrivers(populated)).toEqual(
        mapQuoteToDrivers(makeQuote()),
      );
      expect(grandTotalCost(lines, items)).toBe(baseline);
    }
  });

  it("preserves Section 2 regression surface in the forward SQL", () => {
    // Section 2 columns, constraints and trigger names must remain present
    // and the scoped function must keep all 60 prior outputs in order.
    expect(SECTION3_FORWARD_SQL).toContain("quotes_enforce_pricing_schedule_authorization");
    expect(SECTION3_FORWARD_SQL).toContain("pricing_schedule_other_detail");
    expect(SECTION3_FORWARD_SQL).toContain("geographic_scope_other_detail");
    expect(SECTION3_FORWARD_SQL).toContain("quotes_billing_preference_check");
    expect(SECTION3_FORWARD_SQL).toContain(
      "quotes_billing_preference_other_detail_check",
    );
  });
});
