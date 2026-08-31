import {
  DEFAULT_LEAD_FILTERS,
  DEFAULT_LEAD_SORT,
  LEAD_STATUSES,
  type LeadFilters,
  type LeadSort,
  type LeadSortColumn,
  type LeadSortDirection,
  type LeadStatus,
} from "./types";

/** URL-encoded shape of the lead queue view state. */
export interface LeadSearch {
  statuses: string;
  assignee: string;
  q: string;
  page: number;
  sort: LeadSortColumn;
  dir: LeadSortDirection;
}

const SORT_COLUMNS: LeadSortColumn[] = [
  "submitted_at",
  "organization_name",
  "lead_score",
  "status",
];

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Route-level `validateSearch`: total, never throws, always typed. */
export function validateLeadSearch(input: Record<string, unknown>): LeadSearch {
  const rawPage = Number(input["page"]);
  const sortRaw = str(input["sort"]) as LeadSortColumn;
  return {
    statuses: str(input["statuses"]),
    assignee: str(input["assignee"]),
    q: str(input["q"]),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 0,
    sort: SORT_COLUMNS.includes(sortRaw) ? sortRaw : DEFAULT_LEAD_SORT.column,
    dir: str(input["dir"]) === "asc" ? "asc" : "desc",
  };
}

export function searchToLeadFilters(search: LeadSearch): LeadFilters {
  const statuses = search.statuses
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is LeadStatus => (LEAD_STATUSES as readonly string[]).includes(s));
  return {
    statuses: statuses.length > 0 ? statuses : DEFAULT_LEAD_FILTERS.statuses,
    assignee: search.assignee || null,
    search: search.q,
  };
}

export function searchToLeadSort(search: LeadSearch): LeadSort {
  return { column: search.sort, direction: search.dir };
}

/** Serializes filters back into URL params, omitting defaults for clean URLs. */
export function leadFiltersToSearch(
  filters: LeadFilters,
  sort: LeadSort,
  page: number,
): LeadSearch {
  const allStatuses = filters.statuses.length === LEAD_STATUSES.length;
  return {
    statuses: allStatuses ? "" : filters.statuses.join(","),
    assignee: filters.assignee ?? "",
    q: filters.search,
    page,
    sort: sort.column,
    dir: sort.direction,
  };
}

/** Default URL state, used for plain links into the lead queue. */
export const DEFAULT_LEAD_SEARCH: LeadSearch = leadFiltersToSearch(
  DEFAULT_LEAD_FILTERS,
  DEFAULT_LEAD_SORT,
  0,
);
