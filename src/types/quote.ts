import { z } from "zod";

/** Workflow state of a quote as it moves through the approval gate. */
export type QuoteState =
  | "draft"
  | "submitted_for_review"
  | "under_review"
  | "estimator_adjusted"
  | "approved"
  | "sent_to_customer"
  | "accepted"
  | "declined"
  | "archived";

/** Fidelity of the quote: rough ballpark vs. formal proposal. */
export type QuoteTier = "ballpark" | "proposal";

/** Compliance regimes a deployment may be required to satisfy. */
export type Compliance =
  | "fedramp_moderate"
  | "fedramp_high"
  | "soc2_type2"
  | "hipaa"
  | "cjis"
  | "stateramp"
  | "irs_1075";

/** Procurement/customer classification. */
export type CustomerType =
  | "state_naspo"
  | "state_non_naspo"
  | "federal"
  | "county"
  | "tribal"
  | "commercial";

/** How closely the opportunity matches an existing repeatable deployment. */
export type RepeatableActivation = "full_match" | "partial_match" | "novel";

/** Product module packaging level. */
export type ModuleTier = "standard" | "enterprise";

/** Where the solution is hosted. */
export type HostingModel = "soc2" | "fedramp" | "regular";

/** Contracted support level. */
export type SupportTier = "standard" | "enhanced" | "premium";

/** Difficulty band for integration work. */
export type IntegrationComplexity =
  | "simple"
  | "moderate"
  | "complex"
  | "very_complex";

/**
 * One integration in scope. Display numbering ("Integration 1", ...) is
 * computed from the array index and never persisted.
 */
export interface IntegrationItem {
  difficulty: IntegrationComplexity;
}

/** Sales rep's confidence in the opportunity. */
export type RepConfidence = "high" | "medium" | "low";

/** Q1.4 — reporting-only opportunity stage. No pricing effect. */
export type OpportunityStage =
  | "discovery"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed"
  | "other";

/** Q1.7 — internal deal priority. No pricing effect. */
export type DealPriority = "standard" | "strategic" | "rush" | "other";

/** Q1.8 — deal shape chosen at creation. No pricing effect. */
export type DealTemplate =
  | "state_workers_comp"
  | "state_health_benefits"
  | "county_justice_modernization"
  | "federal_small_deployment"
  | "blank"
  | "other";

/** Q2.2 — Proposal-only geographic/procurement breadth of the engagement. */
export type GeographicScope =
  | "single_agency"
  | "multi_agency_same_state"
  | "multi_state"
  | "national"
  | "other";

/** Q2.3 — declared pricing basis. Stored metadata only; does not alter calculations. */
export type PricingSchedule = "naspo" | "list" | "custom" | "other";

/** Q3.4 — Proposal-only commercial billing cadence. No pricing effect. */
export type BillingPreference =
  | "monthly"
  | "annual_upfront"
  | "annual_quarterly"
  | "other";

/** Legacy record volume band for data migration. */
export type MigrationVolumeRange = "<100k" | "100k-1m" | "1m-5m" | "5m+";

/** Number of forms expected across the portals. */
export type PortalFormCountRange = "1-3" | "4-10" | "11-25" | "26+";

/** Q4.3 — Proposal-only expected user growth. No pricing effect. */
export type ExpectedUserGrowth = "flat" | "moderate" | "high" | "rapid" | "other";

/** Q4.6 — Proposal-only peak load profile (categorical). No pricing effect. */
export type PeakLoadProfile = "steady" | "seasonal" | "high_burst" | "other";


/** Full quote shape including workflow metadata. */
export interface Quote {
  id: string;
  ownerId: string | null;
  requestedBy: string;
  reviewedBy: string | null;
  /** Estimator who most recently returned this quote for edit. */
  lastReviewedBy: string | null;
  approvedBy: string | null;
  name: string;
  customerName: string | null;
  customerEmail: string | null;
  customerType: CustomerType | null;
  /** Q1.4 — reporting only. */
  opportunityStage: OpportunityStage;
  /** Q1.7 — internal only. */
  dealPriority: DealPriority;
  /** Q1.8 — optional deal shape selected at creation. */
  dealTemplate: DealTemplate | null;
  /** Q1.9 — ISO date (yyyy-MM-dd). Blank means no validity statement. */
  quoteValidityDate: string | null;
  /** Q2.2 — Proposal-only engagement/procurement breadth. Never mapped from the lead's world-geography region. */
  geographicScope: GeographicScope | null;
  /** Free-text detail when geographicScope is "other". */
  geographicScopeOtherDetail: string | null;
  /** Q2.3 — declared pricing basis. Explicit metadata; no pricing effect in this slice. */
  pricingSchedule: PricingSchedule | null;
  /** Free-text detail when pricingSchedule is "other". Never shown to sales reps or external users. */
  pricingScheduleOtherDetail: string | null;
  /** Q3.4 — Proposal-only billing cadence. Optional; never affects pricing. */
  billingPreference: BillingPreference | null;
  /** Free-text detail when billingPreference is "other". Hidden from external users. */
  billingPreferenceOtherDetail: string | null;
  compliance: Compliance[];
  vertical: string | null;
  solution: string | null;
  /** Free-text area of need, only used when vertical is "other". */
  verticalOtherDetail: string | null;
  repeatableActivation: RepeatableActivation;
  moduleTier: ModuleTier | null;
  contractYears: number;
  expectedAwardDate: string | null;
  caseWorkerCount: number | null;
  includeB2c: boolean;
  b2cMau: number | null;
  includeB2bPortal: boolean;
  b2bUserCount: number | null;
  hostingModel: HostingModel | null;
  environmentCount: number;
  hasIntegrations: boolean;
  /** Per-integration difficulty list; supersedes the two legacy fields below. */
  integrations: IntegrationItem[];
  /** @deprecated legacy flat count — retained, unused. */
  integrationCount: number | null;
  /** @deprecated legacy flat difficulty — retained, unused. */
  integrationDifficulty: IntegrationComplexity | null;
  supportTier: SupportTier | null;
  marginPercent: number;
  marginJustification: string | null;
  /** Contingency stored as a fraction (0–1); null means "never set". */
  contingencyPct: number;
  repConfidence: RepConfidence | null;
  tier: QuoteTier;
  migrationRequired: boolean | null;
  migrationVolumeRange: MigrationVolumeRange | null;
  migrationCleanupRequired: boolean | null;
  externalIdpRequired: boolean | null;
  workerIdpRequired: boolean | null;
  idpDocumented: boolean | null;
  portalFormCountRange: PortalFormCountRange | null;
  /** Q4.2 — Proposal-only, integer 0–50. Persist-only. */
  caseWorkerStudioUsers: number | null;
  /** Q4.3 — Proposal-only. Persist-only. */
  expectedUserGrowth: ExpectedUserGrowth | null;
  expectedUserGrowthOtherDetail: string | null;
  /** Q4.6 — categorical label (NOT numeric) despite the column name. Persist-only. */
  peakLoadMultiplier: PeakLoadProfile | null;
  peakLoadMultiplierOtherDetail: string | null;
  /** Q4.8 — Proposal-only. Persist-only; never derives b2bUserCount. */
  b2bOrgCount: number | null;
  /** Q4.9 — Proposal-only. Persist-only; never derives b2bUserCount. */
  b2bAvgUsersPerOrg: number | null;

  /** Flags a draft that was handed to this rep and still needs review. */
  needsAttention: boolean;

  state: QuoteState;
  submittedAt: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const complianceValues = [
  "fedramp_moderate",
  "fedramp_high",
  "soc2_type2",
  "hipaa",
  "cjis",
  "stateramp",
  "irs_1075",
] as const;

/**
 * Submission-time validation. Draft quotes may hold nulls in the optional
 * fields; the required fields below must be present to submit for review.
 */
export const quoteSchema = z.object({
  name: z.string().default(""),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email().nullable().default(null),
  customerType: z.enum([
    "state_naspo",
    "state_non_naspo",
    "federal",
    "county",
    "tribal",
    "commercial",
  ]),
  // Section 1 metadata (Q1.4, Q1.7, Q1.8, Q1.9). Reporting/administrative
  // only — none of these participate in any pricing calculation.
  opportunityStage: z
    .enum(["discovery", "qualified", "proposal", "negotiation", "closed", "other"])
    .default("discovery"),
  dealPriority: z
    .enum(["standard", "strategic", "rush", "other"])
    .default("standard"),
  dealTemplate: z
    .enum([
      "state_workers_comp",
      "state_health_benefits",
      "county_justice_modernization",
      "federal_small_deployment",
      "blank",
      "other",
    ])
    .nullable()
    .default(null),
  quoteValidityDate: z
    .string()
    .refine(
      (v) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
        // Reject impossible calendar dates like 2026-13-01.
        const parts = v.split("-").map(Number);
        const [y, m, d] = parts as [number, number, number];
        const date = new Date(Date.UTC(y, m - 1, d));
        return (
          date.getUTCFullYear() === y &&
          date.getUTCMonth() + 1 === m &&
          date.getUTCDate() === d
        );
      },
      "Use a valid YYYY-MM-DD date",
    )
    .nullable()
    .default(null),
  // Section 2 (Q2.2, Q2.3). Proposal-only metadata; nullable so Ballpark
  // quotes are untouched. Neither field participates in any calculation.
  geographicScope: z
    .enum(["single_agency", "multi_agency_same_state", "multi_state", "national", "other"])
    .nullable()
    .default(null),
  geographicScopeOtherDetail: z.string().nullable().default(null),
  pricingSchedule: z
    .enum(["naspo", "list", "custom", "other"])
    .nullable()
    .default(null),
  pricingScheduleOtherDetail: z.string().nullable().default(null),
  // Section 3 (Q3.4). Proposal-only, optional at every lifecycle gate.
  billingPreference: z
    .enum(["monthly", "annual_upfront", "annual_quarterly", "other"])
    .nullable()
    .default(null),
  billingPreferenceOtherDetail: z.string().nullable().default(null),
  compliance: z.array(z.enum(complianceValues)).default([]),
  vertical: z.string().min(1, "Vertical is required"),
  // Solution is required for every real vertical; "other" replaces it with a
  // free-text description instead (see the superRefine below).
  solution: z.string().default(""),
  verticalOtherDetail: z.string().nullable().default(null),

  repeatableActivation: z
    .enum(["full_match", "partial_match", "novel"])
    .default("novel"),
  moduleTier: z.enum(["standard", "enterprise"]),
  contractYears: z.number().int().min(1).max(10),
  expectedAwardDate: z.string().nullable().default(null),
  caseWorkerCount: z.number().int().min(0).nullable().default(null),
  includeB2c: z.boolean().default(false),
  b2cMau: z.number().int().min(0).nullable().default(null),
  includeB2bPortal: z.boolean().default(false),
  b2bUserCount: z.number().int().min(0).nullable().default(null),
  hostingModel: z.enum(["soc2", "fedramp", "regular"]),
  environmentCount: z.number().int().min(1).default(1),
  hasIntegrations: z.boolean().default(false),
  integrations: z
    .array(
      z.object({
        difficulty: z.enum(["simple", "moderate", "complex", "very_complex"]),
      }),
    )
    .default([]),
  integrationCount: z.number().int().min(0).nullable().default(null),
  integrationDifficulty: z
    .enum(["simple", "moderate", "complex", "very_complex"])
    .nullable()
    .default(null),
  supportTier: z.enum(["standard", "enhanced", "premium"]),
  marginPercent: z.number().min(0).max(100).default(20),
  marginJustification: z.string().nullable().default(null),
  contingencyPct: z.number().min(0).max(1).default(0),
  repConfidence: z.enum(["high", "medium", "low"]).nullable().default(null),
  tier: z.enum(["ballpark", "proposal"]).default("ballpark"),
  // Additive complexity-driver inputs — all optional/nullable.
  migrationRequired: z.boolean().nullable().default(null),
  migrationVolumeRange: z
    .enum(["<100k", "100k-1m", "1m-5m", "5m+"])
    .nullable()
    .default(null),
  migrationCleanupRequired: z.boolean().nullable().default(null),
  externalIdpRequired: z.boolean().nullable().default(null),
  workerIdpRequired: z.boolean().nullable().default(null),
  idpDocumented: z.boolean().nullable().default(null),
  portalFormCountRange: z
    .enum(["1-3", "4-10", "11-25", "26+"])
    .nullable()
    .default(null),
  // Section 4 Proposal-only sizing (persist-only). NO defaults: a Zod
  // default would be autosaved onto Ballpark quotes.
  caseWorkerStudioUsers: z.number().int().min(0).max(50).nullable().optional(),
  expectedUserGrowth: z.enum(["flat", "moderate", "high", "rapid", "other"]).nullable().optional(),
  expectedUserGrowthOtherDetail: z.string().nullable().optional(),
  peakLoadMultiplier: z.enum(["steady", "seasonal", "high_burst", "other"]).nullable().optional(),
  peakLoadMultiplierOtherDetail: z.string().nullable().optional(),
  b2bOrgCount: z.number().int().min(0).nullable().optional(),
  b2bAvgUsersPerOrg: z.number().int().min(0).nullable().optional(),

}).superRefine((value, ctx) => {
  // Q2.2/Q2.3 — the universal "Other" rule: choosing Other requires detail.
  if (value.geographicScope === "other" && !(value.geographicScopeOtherDetail ?? "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["geographicScopeOtherDetail"],
      message: "Please describe the geographic scope",
    });
  }
  if (value.pricingSchedule === "other" && !(value.pricingScheduleOtherDetail ?? "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pricingScheduleOtherDetail"],
      message: "Please describe the pricing schedule",
    });
  }

  // Q3.4 — the same universal "Other" rule. Q3.4 itself stays optional:
  // leaving billingPreference null never blocks completion or submission.
  if (
    value.billingPreference === "other" &&
    !(value.billingPreferenceOtherDetail ?? "").trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["billingPreferenceOtherDetail"],
      message: "Please describe the billing preference",
    });
  }

  // Q3.4 — mirror of the database constraint: the detail may only exist
  // alongside "other". This keeps autosave from ever sending a pair the
  // quotes_billing_preference_other_detail_check constraint would reject.
  if (
    value.billingPreference !== "other" &&
    (value.billingPreferenceOtherDetail ?? "") !== ""
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["billingPreferenceOtherDetail"],
      message: "Billing preference detail applies only to \"Other\"",
    });
  }

  // Q2.3 — a Proposal must declare its pricing schedule before it is
  // submitted. Ballpark quotes never carry this requirement.
  if (value.tier === "proposal" && value.pricingSchedule == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["pricingSchedule"],
      message: "Pricing schedule is required before submitting a Proposal",
    });
  }

  // Section 4 (Q4.3 / Q4.6) coherence rules — mirror the DB CASE-form
  // constraints. Gated on tier so Ballpark submission is never blocked.
  if (value.tier !== "proposal") return;
  if (value.expectedUserGrowth === "other" && !value.expectedUserGrowthOtherDetail?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expectedUserGrowthOtherDetail"],
      message: "Please describe the expected growth pattern.",
    });
  }
  if (value.expectedUserGrowth !== "other" && value.expectedUserGrowthOtherDetail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expectedUserGrowthOtherDetail"],
      message: 'Detail is only allowed when "Other" is selected.',
    });
  }
  if (value.peakLoadMultiplier === "other" && !value.peakLoadMultiplierOtherDetail?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["peakLoadMultiplierOtherDetail"],
      message: "Please describe the peak load profile.",
    });
  }
  if (value.peakLoadMultiplier !== "other" && value.peakLoadMultiplierOtherDetail) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["peakLoadMultiplierOtherDetail"],
      message: 'Detail is only allowed when "Other" is selected.',
    });
  }
}).superRefine((value, ctx) => {

  // "Yes, we need integrations" requires at least one listed integration.
  if (value.hasIntegrations && value.integrations.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["integrations"],
      message: "Please add at least one integration",
    });
  }

  // "Other" verticals describe their need in free text instead of picking a
  // catalog solution; every other vertical must pick a solution.
  if (value.vertical === "other") {
    if (!value.verticalOtherDetail || value.verticalOtherDetail.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verticalOtherDetail"],
        message: "Please describe your area of need",
      });
    }
  } else if (value.vertical && value.solution.trim() === "") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["solution"],
      message: "Solution is required",
    });
  }
});


export type QuoteFormData = z.infer<typeof quoteSchema>;
