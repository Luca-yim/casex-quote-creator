import type { QuoteState } from "@/types/quote";

/**
 * Filter/sort contracts for the shared Pipeline view.
 *
 * Deliberately deferred (do NOT add without a new requirement):
 * CSV export, bulk operations, edit actions, advanced analytics,
 * saved filter presets, and realtime updates (60s stale time is accepted).
 */

/** Quote states surfaced in the pipeline, excluding `archived`. */
export const PIPELINE_STATES = [
  "approved",
  "sent_to_customer",
  "accepted",
  "declined",
] as const;

export type PipelineState = (typeof PIPELINE_STATES)[number];

export const STATE_LABELS: Record<string, string> = {
  approved: "Approved",
  sent_to_customer: "Sent to customer",
  accepted: "Accepted",
  declined: "Declined",
  archived: "Archived",
};

export interface PipelineFilters {
  states: QuoteState[];
  includeArchived: boolean;
  vertical: string | null;
  solution: string | null;
  /** ISO date (yyyy-mm-dd) lower bound on `approved_at`. */
  dateFrom: string | null;
  /** ISO date (yyyy-mm-dd) upper bound on `approved_at`. */
  dateTo: string | null;
  ownerId: string | "unassigned" | null;
  estimatorId: string | null;
  search: string;
}

export const DEFAULT_FILTERS: PipelineFilters = {
  states: [...PIPELINE_STATES],
  includeArchived: false,
  vertical: null,
  solution: null,
  dateFrom: null,
  dateTo: null,
  ownerId: null,
  estimatorId: null,
  search: "",
};

/** Columns the table can sort by. `tcv` is sorted client-side (computed). */
export type SortColumn = "customer_name" | "tcv" | "approved_at" | "days_since_approved";
export type SortDirection = "asc" | "desc";

export interface PipelineSort {
  column: SortColumn;
  direction: SortDirection;
}

export const DEFAULT_SORT: PipelineSort = { column: "approved_at", direction: "desc" };

export const PAGE_SIZE = 50;

/** Admin-only columns, hidden by default and persisted in localStorage. */
export const ADMIN_COLUMNS = [
  { id: "requested_by", label: "Requested by" },
  { id: "days_since_approved", label: "Days since approved" },
  { id: "margin_percent", label: "Margin %" },
  { id: "repeatable_activation", label: "Repeatable activation" },
] as const;

export type AdminColumnId = (typeof ADMIN_COLUMNS)[number]["id"];

export type AdminColumnVisibility = Record<AdminColumnId, boolean>;

export const DEFAULT_ADMIN_COLUMNS: AdminColumnVisibility = {
  requested_by: false,
  days_since_approved: false,
  margin_percent: false,
  repeatable_activation: false,
};

/** Effective state list sent to the database query. */
export function effectiveStates(filters: PipelineFilters): string[] {
  const base = filters.states.filter((s) => s !== "archived");
  return filters.includeArchived ? [...base, "archived"] : base;
}

export function filtersAreDefault(filters: PipelineFilters): boolean {
  return (
    filters.states.length === PIPELINE_STATES.length &&
    !filters.includeArchived &&
    !filters.vertical &&
    !filters.solution &&
    !filters.dateFrom &&
    !filters.dateTo &&
    !filters.ownerId &&
    !filters.estimatorId &&
    filters.search.trim() === ""
  );
}
