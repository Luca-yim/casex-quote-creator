import type { AppRole } from "@/lib/auth-types";

/**
 * Columns on `public.quotes` that carry commercial/pricing intent.
 *
 * External (customer) users must never receive these over the wire — hiding
 * them in the UI is not enough, because the raw PostgREST response is visible
 * in the browser's network tab.
 */
export const PRICING_SENSITIVE_QUOTE_COLUMNS = [
  "margin_percent",
  "margin_justification",
  "rep_confidence",
] as const;

/** Every non-pricing column the app maps in `rowToQuote`. */
const SAFE_QUOTE_COLUMNS = [
  "id",
  "owner_id",
  "requested_by",
  "reviewed_by",
  "approved_by",
  "name",
  "customer_name",
  "customer_email",
  "customer_type",
  "compliance",
  "vertical",
  "solution",
  "repeatable_activation",
  "module_tier",
  "contract_years",
  "target_go_live_date",
  "case_worker_count",
  "include_b2c",
  "b2c_mau",
  "include_b2b_portal",
  "b2b_user_count",
  "hosting_model",
  "environment_count",
  "has_integrations",
  "integration_count",
  "integration_difficulty",
  "support_tier",
  "tier",
  "state",
  "submitted_at",
  "approved_at",
  "sent_at",
  "created_at",
  "updated_at",
] as const;

const EXTERNAL_SELECT = SAFE_QUOTE_COLUMNS.join(", ");

/**
 * Returns the `select()` projection to use for a role.
 *
 * External users get an explicit safe-column list; every internal role keeps
 * the full row so estimator/rep pricing behaviour is unchanged.
 */
export function quoteSelectForRole(role: AppRole | null | undefined): string {
  return role === "external" ? EXTERNAL_SELECT : "*";
}

/** True when the signed-in role must never receive catalog rates. */
export function shouldHidePricingData(role: AppRole | null | undefined): boolean {
  return role === "external";
}
