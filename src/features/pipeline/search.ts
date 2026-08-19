import type { QuoteState } from "@/types/quote";
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  PIPELINE_STATES,
  type PipelineFilters,
  type PipelineSort,
  type SortColumn,
  type SortDirection,
} from "./types";

/** URL-encoded shape of the pipeline view state. */
export interface PipelineSearch {
  states: string;
  archived: boolean;
  vertical: string;
  solution: string;
  from: string;
  to: string;
  owner: string;
  estimator: string;
  q: string;
  page: number;
  sort: SortColumn;
  dir: SortDirection;
}

const SORT_COLUMNS: SortColumn[] = [
  "customer_name",
  "tcv",
  "approved_at",
  "days_since_approved",
];

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Route-level `validateSearch`: total, never throws, always typed. */
export function validatePipelineSearch(input: Record<string, unknown>): PipelineSearch {
  const rawPage = Number(input["page"]);
  const sortRaw = str(input["sort"]) as SortColumn;
  const dirRaw = str(input["dir"]);
  return {
    states: str(input["states"]),
    archived: input["archived"] === true || input["archived"] === "true",
    vertical: str(input["vertical"]),
    solution: str(input["solution"]),
    from: str(input["from"]),
    to: str(input["to"]),
    owner: str(input["owner"]),
    estimator: str(input["estimator"]),
    q: str(input["q"]),
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 0,
    sort: SORT_COLUMNS.includes(sortRaw) ? sortRaw : DEFAULT_SORT.column,
    dir: dirRaw === "asc" ? "asc" : "desc",
  };
}

/** Hydrates the filter object from URL search params. */
export function searchToFilters(search: PipelineSearch): PipelineFilters {
  const states = search.states
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is QuoteState =>
      (PIPELINE_STATES as readonly string[]).includes(s),
    );
  return {
    states: states.length > 0 ? states : DEFAULT_FILTERS.states,
    includeArchived: search.archived,
    vertical: search.vertical || null,
    solution: search.solution || null,
    dateFrom: search.from || null,
    dateTo: search.to || null,
    ownerId: search.owner || null,
    estimatorId: search.estimator || null,
    search: search.q,
  };
}

export function searchToSort(search: PipelineSearch): PipelineSort {
  return { column: search.sort, direction: search.dir };
}

/** Serializes filters back into URL params, omitting defaults for clean URLs. */
export function filtersToSearch(
  filters: PipelineFilters,
  sort: PipelineSort,
  page: number,
): PipelineSearch {
  const allStates = filters.states.length === PIPELINE_STATES.length;
  return {
    states: allStates ? "" : filters.states.join(","),
    archived: filters.includeArchived,
    vertical: filters.vertical ?? "",
    solution: filters.solution ?? "",
    from: filters.dateFrom ?? "",
    to: filters.dateTo ?? "",
    owner: filters.ownerId ?? "",
    estimator: filters.estimatorId ?? "",
    q: filters.search,
    page,
    sort: sort.column,
    dir: sort.direction,
  };
}

/** Default URL state, used for plain links into the pipeline. */
export const DEFAULT_PIPELINE_SEARCH: PipelineSearch = filtersToSearch(
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  0,
);
