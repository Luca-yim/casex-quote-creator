import type { Quote } from "@/types/quote";

import type { Database } from "@/lib/database.types";

type QuoteTableRow = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteViewRow = Database["public"]["Views"]["quotes_scoped"]["Row"];

/**
 * Accepts rows from either the base table or the role-scoped read view; the
 * view nulls pricing columns for roles that must not receive them.
 */
type QuoteRow = QuoteTableRow | QuoteViewRow;

/** Maps a snake_case `quotes` row from the database into the `Quote` domain shape. */
export function rowToQuote(row: QuoteRow): Quote {
  const r = row as QuoteRow & Record<string, any>;
  return {
    id: r["id"],
    ownerId: r["owner_id"] ?? null,
    requestedBy: r["requested_by"],
    reviewedBy: r["reviewed_by"] ?? null,
    lastReviewedBy: r["last_reviewed_by"] ?? null,
    
    approvedBy: r["approved_by"] ?? null,
    name: r["name"] ?? "Untitled quote",
    customerName: r["customer_name"] ?? null,
    customerEmail: r["customer_email"] ?? null,
    customerType: (r["customer_type"] ?? null) as Quote["customerType"],
    compliance: (r["compliance"] ?? []) as Quote["compliance"],
    vertical: r["vertical"] ?? null,
    solution: r["solution"] ?? null,
    repeatableActivation: (r["repeatable_activation"] ??
      "novel") as Quote["repeatableActivation"],
    moduleTier: (r["module_tier"] ?? null) as Quote["moduleTier"],
    contractYears: Number(r["contract_years"] ?? 1),
    targetGoLiveDate: r["target_go_live_date"] ?? null,
    caseWorkerCount: r["case_worker_count"] ?? null,
    includeB2c: Boolean(r["include_b2c"]),
    b2cMau: r["b2c_mau"] ?? null,
    includeB2bPortal: Boolean(r["include_b2b_portal"]),
    b2bUserCount: r["b2b_user_count"] ?? null,
    hostingModel: (r["hosting_model"] ?? null) as Quote["hostingModel"],
    environmentCount: Number(r["environment_count"] ?? 1),
    hasIntegrations: Boolean(r["has_integrations"]),
    integrationCount:
      r["integration_count"] === null || r["integration_count"] === undefined
        ? null
        : Number(r["integration_count"]),
    integrationDifficulty: (r["integration_difficulty"] ?? null) as Quote["integrationDifficulty"],
    supportTier: (r["support_tier"] ?? null) as Quote["supportTier"],
    marginPercent: Number(r["margin_percent"] ?? 20),
    marginJustification: r["margin_justification"] ?? null,
    repConfidence: (r["rep_confidence"] ?? null) as Quote["repConfidence"],
    tier: (r["tier"] ?? "ballpark") as Quote["tier"],
    state: (r["state"] ?? "draft") as Quote["state"],
    submittedAt: r["submitted_at"] ?? null,
    approvedAt: r["approved_at"] ?? null,
    sentAt: r["sent_at"] ?? null,
    createdAt: r["created_at"],
    updatedAt: r["updated_at"],
  };
}

/** Maps camelCase quote field paths back to their database column names. */
export const QUOTE_FIELD_COLUMNS: Record<string, string> = {
  name: "name",
  customerName: "customer_name",
  customerEmail: "customer_email",
  customerType: "customer_type",
  compliance: "compliance",
  vertical: "vertical",
  solution: "solution",
  repeatableActivation: "repeatable_activation",
  moduleTier: "module_tier",
  contractYears: "contract_years",
  targetGoLiveDate: "target_go_live_date",
  caseWorkerCount: "case_worker_count",
  includeB2c: "include_b2c",
  b2cMau: "b2c_mau",
  includeB2bPortal: "include_b2b_portal",
  b2bUserCount: "b2b_user_count",
  hostingModel: "hosting_model",
  environmentCount: "environment_count",
  hasIntegrations: "has_integrations",
  integrationCount: "integration_count",
  integrationDifficulty: "integration_difficulty",
  supportTier: "support_tier",
  marginPercent: "margin_percent",
  marginJustification: "margin_justification",
  repConfidence: "rep_confidence",
  tier: "tier",
};
