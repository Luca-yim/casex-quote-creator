import type { AppRole } from "@/lib/auth-types";
import type { Lead } from "./lead-mapper";
import { isUnclaimed } from "./lead-mapper";

/**
 * Client-side UX gating for lead actions.
 *
 * The database policy (`internal_updates_lead`) allows sales_rep, estimator
 * and admin to update ANY lead row. That is deliberately broader than what
 * makes sense in the UI, so the queue narrows two actions:
 *
 * - `assign`   — admin only. Reassigning another person's lead is a
 *                territory decision, not an individual-contributor one.
 * - `duplicate`— estimator/admin only. Merging lead identities is a
 *                data-integrity act; reps flag, triage owners decide.
 *
 * These are conventions enforced in the UI only. If they must be guarantees,
 * the RLS policy has to be tightened server-side as well.
 */
export const LEAD_ACTION_ROLES = {
  claim: ["sales_rep", "estimator", "admin"] as AppRole[],
  qualify: ["sales_rep", "estimator", "admin"] as AppRole[],
  disqualify: ["sales_rep", "estimator", "admin"] as AppRole[],
  assign: ["admin"] as AppRole[],
  duplicate: ["estimator", "admin"] as AppRole[],
};

export type LeadAction = keyof typeof LEAD_ACTION_ROLES;

export function canPerformLeadAction(role: AppRole | null, action: LeadAction): boolean {
  return role !== null && LEAD_ACTION_ROLES[action].includes(role);
}

/** Claim is additionally gated on the lead genuinely being unheld. */
export function canClaimLead(role: AppRole | null, lead: Lead): boolean {
  return canPerformLeadAction(role, "claim") && isUnclaimed(lead);
}
