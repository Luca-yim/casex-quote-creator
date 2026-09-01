import type { Database } from "@/lib/database.types";
import type { LeadStatus } from "./types";

type LeadRow = Database["public"]["Tables"]["lead_intakes"]["Row"];

/** Domain shape of a public lead intake, camelCased for the UI. */
export interface Lead {
  id: string;
  leadNumber: string | null;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  region: string | null;
  vertical: string | null;
  solution: string | null;
  internalUserRange: string | null;
  externalPortalRequired: boolean | null;
  b2bPortalRequired: boolean | null;
  hostingPreference: string | null;
  complianceRequirements: string[];
  integrationRequired: boolean | null;
  integrationCountRange: string | null;
  integrationDifficulty: string | null;
  additionalNotes: string | null;
  status: LeadStatus;
  leadScore: number | null;
  leadScoreLabel: string | null;
  confidencePct: number | null;
  duplicateOfLeadId: string | null;
  assignedRepId: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  convertedQuoteId: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Maps a snake_case `lead_intakes` row into the `Lead` domain shape. */
export function rowToLead(row: LeadRow): Lead {
  const r = row as LeadRow & Record<string, any>;
  return {
    id: r["id"],
    leadNumber: r["lead_number"] ?? null,
    organizationName: r["organization_name"] ?? "",
    contactName: r["contact_name"] ?? "",
    contactEmail: r["contact_email"] ?? "",
    contactPhone: r["contact_phone"] ?? null,
    region: r["region"] ?? null,
    vertical: r["vertical"] ?? null,
    solution: r["solution"] ?? null,
    internalUserRange: r["internal_user_range"] ?? null,
    externalPortalRequired: r["external_portal_required"] ?? null,
    b2bPortalRequired: r["b2b_portal_required"] ?? null,
    hostingPreference: r["hosting_preference"] ?? null,
    complianceRequirements: (r["compliance_requirements"] ?? []) as string[],
    integrationRequired: r["integration_required"] ?? null,
    integrationCountRange: r["integration_count_range"] ?? null,
    integrationDifficulty: r["integration_difficulty"] ?? null,
    additionalNotes: r["additional_notes"] ?? null,
    status: (r["status"] ?? "new_lead") as LeadStatus,
    leadScore: r["lead_score"] ?? null,
    leadScoreLabel: r["lead_score_label"] ?? null,
    confidencePct: r["confidence_pct"] ?? null,
    duplicateOfLeadId: r["duplicate_of_lead_id"] ?? null,
    assignedRepId: r["assigned_rep_id"] ?? null,
    claimedBy: r["claimed_by"] ?? null,
    claimedAt: r["claimed_at"] ?? null,
    convertedQuoteId: r["converted_quote_id"] ?? null,
    submittedAt: r["submitted_at"] ?? null,
    createdAt: r["created_at"],
    updatedAt: r["updated_at"],
  };
}

/** A lead is claimable only when nobody holds it in either field. */
export function isUnclaimed(lead: Lead): boolean {
  return lead.assignedRepId === null && lead.claimedBy === null;
}
