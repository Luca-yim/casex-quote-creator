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
export type HostingModel = "soc2" | "fedramp" | "customer_hosted";

/** Contracted support level. */
export type SupportTier = "standard" | "enhanced" | "premium";

/** Difficulty band for integration work. */
export type IntegrationComplexity =
  | "simple"
  | "moderate"
  | "complex"
  | "very_complex";

/** Sales rep's confidence in the opportunity. */
export type RepConfidence = "high" | "medium" | "low";

/** Legacy record volume band for data migration. */
export type MigrationVolumeRange = "<100k" | "100k-1m" | "1m-5m" | "5m+";

/** Number of forms expected across the portals. */
export type PortalFormCountRange = "1-3" | "4-10" | "11-25" | "26+";


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
  compliance: Compliance[];
  vertical: string | null;
  solution: string | null;
  repeatableActivation: RepeatableActivation;
  moduleTier: ModuleTier | null;
  contractYears: number;
  targetGoLiveDate: string | null;
  caseWorkerCount: number | null;
  includeB2c: boolean;
  b2cMau: number | null;
  includeB2bPortal: boolean;
  b2bUserCount: number | null;
  hostingModel: HostingModel | null;
  environmentCount: number;
  hasIntegrations: boolean;
  integrationCount: number | null;
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
  targetGoLiveDate: z.string().nullable().default(null),
  caseWorkerCount: z.number().int().min(0).nullable().default(null),
  includeB2c: z.boolean().default(false),
  b2cMau: z.number().int().min(0).nullable().default(null),
  includeB2bPortal: z.boolean().default(false),
  b2bUserCount: z.number().int().min(0).nullable().default(null),
  hostingModel: z.enum(["soc2", "fedramp", "customer_hosted"]),
  environmentCount: z.number().int().min(1).default(1),
  hasIntegrations: z.boolean().default(false),
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

}).superRefine((value, ctx) => {
  // "Yes, we need integrations" requires a real count — empty is not 0.
  if (
    value.hasIntegrations &&
    (value.integrationCount === null || value.integrationCount < 1)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["integrationCount"],
      message: "Please enter the number of integrations required",
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
