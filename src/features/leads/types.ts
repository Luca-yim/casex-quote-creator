/**
 * Filter/sort contracts for the Lead Queue.
 *
 * Mirrors `src/features/pipeline/types.ts` deliberately so the two internal
 * queues stay structurally identical for future maintenance.
 *
 * Deferred on purpose: CSV export, bulk actions, saved presets, realtime.
 */

export const LEAD_STATUSES = [
  "new",
  "claimed",
  "qualified",
  "disqualified",
  "duplicate",
  "converted",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Statuses shown by default — closed-out leads are opt-in. */
export const DEFAULT_LEAD_STATUSES: LeadStatus[] = ["new", "claimed", "qualified"];

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  claimed: "Claimed",
  qualified: "Qualified",
  disqualified: "Disqualified",
  duplicate: "Duplicate",
  converted: "Converted",
};

/** `mine` and `unassigned` are resolved against the signed-in user at query time. */
export type AssigneeFilter = string | "mine" | "unassigned" | null;

export interface LeadFilters {
  statuses: LeadStatus[];
  assignee: AssigneeFilter;
  search: string;
}

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  statuses: [...DEFAULT_LEAD_STATUSES],
  assignee: null,
  search: "",
};

export type LeadSortColumn =
  | "submitted_at"
  | "organization_name"
  | "lead_score"
  | "status";
export type LeadSortDirection = "asc" | "desc";

export interface LeadSort {
  column: LeadSortColumn;
  direction: LeadSortDirection;
}

export const DEFAULT_LEAD_SORT: LeadSort = { column: "submitted_at", direction: "desc" };

export const LEAD_PAGE_SIZE = 50;

export function leadFiltersAreDefault(filters: LeadFilters): boolean {
  return (
    filters.statuses.length === DEFAULT_LEAD_STATUSES.length &&
    DEFAULT_LEAD_STATUSES.every((s) => filters.statuses.includes(s)) &&
    !filters.assignee &&
    filters.search.trim() === ""
  );
}
