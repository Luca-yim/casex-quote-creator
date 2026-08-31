import { useCallback, useMemo } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LeadQueueFilters } from "./LeadQueueFilters";
import { LeadQueueTable } from "./LeadQueueTable";
import { LeadStatsCards } from "./LeadStatsCards";
import { useLeadQueue } from "./useLeadQueue";
import { useLeadStats } from "./useLeadStats";
import { leadFiltersToSearch, searchToLeadFilters, searchToLeadSort } from "./search";
import {
  DEFAULT_LEAD_FILTERS,
  LEAD_PAGE_SIZE,
  type LeadFilters,
  type LeadSort,
} from "./types";

const routeApi = getRouteApi("/leads");

/**
 * Internal lead queue over the public `/get-a-quote` submissions.
 *
 * Structurally parallel to `PipelinePage`: URL-driven filters, server-side
 * pagination, standalone stats. Deferred on purpose: CSV export, bulk
 * actions, realtime, saved presets.
 */
export function LeadQueuePage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const filters = useMemo(() => searchToLeadFilters(search), [search]);
  const sort = useMemo(() => searchToLeadSort(search), [search]);
  const page = search.page;

  const leads = useLeadQueue({ filters, page, sort });
  const stats = useLeadStats();

  const applyFilters = useCallback(
    (next: LeadFilters) => {
      void navigate({ search: leadFiltersToSearch(next, sort, 0), replace: true });
    },
    [navigate, sort],
  );

  const applySort = useCallback(
    (nextSort: LeadSort) => {
      void navigate({ search: leadFiltersToSearch(filters, nextSort, 0), replace: true });
    },
    [navigate, filters],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      void navigate({ search: leadFiltersToSearch(filters, sort, nextPage), replace: true });
    },
    [navigate, filters, sort],
  );

  const resetFilters = useCallback(
    () => applyFilters({ ...DEFAULT_LEAD_FILTERS }),
    [applyFilters],
  );

  const rows = leads.data?.rows ?? [];
  const total = leads.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <LeadStatsCards stats={stats.data} isLoading={stats.isLoading} />

      <LeadQueueFilters value={filters} onChange={applyFilters} />

      {leads.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load leads: {(leads.error as Error).message}
        </div>
      ) : (
        <LeadQueueTable
          rows={rows}
          isLoading={leads.isLoading}
          sort={sort}
          onSortChange={applySort}
          onResetFilters={resetFilters}
        />
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {pageCount} · {total} leads
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pageCount}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
