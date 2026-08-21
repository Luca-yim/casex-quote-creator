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
  repConfidence: RepConfidence | null;
  tier: QuoteTier;
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
  solution: z.string().min(1, "Solution is required"),
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
  marginPercent: z.number().min(10).max(30).default(20),
  marginJustification: z.string().nullable().default(null),
  repConfidence: z.enum(["high", "medium", "low"]).nullable().default(null),
  tier: z.enum(["ballpark", "proposal"]).default("ballpark"),
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
});

export type QuoteFormData = z.infer<typeof quoteSchema>;
