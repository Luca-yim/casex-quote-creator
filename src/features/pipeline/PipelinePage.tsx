import { useCallback, useEffect, useMemo, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import { Briefcase, Columns3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { useQuotePdfDownload } from "@/features/pdf-export/useQuotePdfDownload";
import { VersionHistorySheet } from "@/features/intake/VersionHistorySheet";
import type { PdfVersion } from "@/features/pdf-export/types";
import { PipelineFiltersBar } from "./PipelineFilters";
import { PipelineStatsCards } from "./PipelineStatsCards";
import { PipelineTable } from "./PipelineTable";
import { usePipelineQuotes, type PipelineRow } from "./usePipelineQuotes";
import { usePipelineStats } from "./usePipelineStats";
import { filtersToSearch, searchToFilters, searchToSort } from "./search";
import {
  ADMIN_COLUMNS,
  DEFAULT_ADMIN_COLUMNS,
  DEFAULT_FILTERS,
  PAGE_SIZE,
  filtersAreDefault,
  type AdminColumnId,
  type AdminColumnVisibility,
  type PipelineFilters,
  type PipelineSort,
} from "./types";

const routeApi = getRouteApi("/pipeline");

const COLUMN_PREF_KEY = "casex.pipeline.adminColumns";

function loadColumnPrefs(): AdminColumnVisibility {
  if (typeof window === "undefined") return { ...DEFAULT_ADMIN_COLUMNS };
  try {
    const raw = window.localStorage.getItem(COLUMN_PREF_KEY);
    if (!raw) return { ...DEFAULT_ADMIN_COLUMNS };
    const parsed = JSON.parse(raw) as Partial<AdminColumnVisibility>;
    return { ...DEFAULT_ADMIN_COLUMNS, ...parsed };
  } catch {
    return { ...DEFAULT_ADMIN_COLUMNS };
  }
}

/** Page numbers around the current page, max 5 visible. */
function pageWindow(current: number, total: number): number[] {
  const start = Math.max(0, Math.min(current - 2, total - 5));
  return Array.from({ length: Math.min(5, total) }, (_, i) => start + i).filter(
    (p) => p >= 0 && p < total,
  );
}

/**
 * Shared read-only pipeline of approved-and-beyond quotes.
 *
 * Deferred by design: CSV export, bulk operations, inline editing, advanced
 * analytics, saved filter presets and realtime updates (60s stale time).
 */
export function PipelinePage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const filters = useMemo(() => searchToFilters(search), [search]);
  const sort = useMemo(() => searchToSort(search), [search]);
  const page = search.page;

  const catalog = usePricingCatalog();
  const quotes = usePipelineQuotes({ filters, page, sort });
  const stats = usePipelineStats({ filters, catalog: catalog.data });
  const { generatePdf, isGenerating } = useQuotePdfDownload();

  const [historyQuoteId, setHistoryQuoteId] = useState<string | null>(null);
  const [adminColumns, setAdminColumns] = useState<AdminColumnVisibility>(
    DEFAULT_ADMIN_COLUMNS,
  );

  useEffect(() => setAdminColumns(loadColumnPrefs()), []);

  const setColumn = (id: AdminColumnId, visible: boolean) => {
    setAdminColumns((prev) => {
      const next = { ...prev, [id]: visible };
      try {
        window.localStorage.setItem(COLUMN_PREF_KEY, JSON.stringify(next));
      } catch {
        /* preference persistence is best-effort */
      }
      return next;
    });
  };

  // URL is replaced (never pushed) so filtering doesn't spam browser history.
  const applyFilters = useCallback(
    (next: PipelineFilters) => {
      void navigate({ search: filtersToSearch(next, sort, 0), replace: true });
    },
    [navigate, sort],
  );

  const applySort = useCallback(
    (nextSort: PipelineSort) => {
      void navigate({ search: filtersToSearch(filters, nextSort, 0), replace: true });
    },
    [navigate, filters],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      void navigate({ search: filtersToSearch(filters, sort, nextPage), replace: true });
    },
    [navigate, filters, sort],
  );

  const resetFilters = useCallback(() => applyFilters({ ...DEFAULT_FILTERS }), [applyFilters]);

  const rows: PipelineRow[] = quotes.data?.rows ?? [];
  const total = quotes.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showEmptyPipeline =
    !quotes.isLoading && !quotes.isError && total === 0 && filtersAreDefault(filters);

  const downloadPdf = (row: PipelineRow, version: PdfVersion) => {
    void generatePdf(row.quote, version);
  };

  return (
    <div className="space-y-6">

      {showEmptyPipeline ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Briefcase className="size-8 text-muted-foreground" />
            <h2 className="text-base font-semibold">No approved quotes yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Once estimators approve quotes, they&apos;ll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Statistics">
            <PipelineStatsCards
              stats={stats.data}
              isLoading={stats.isLoading || catalog.isLoading}
            />
          </section>

          <section aria-label="Filters">
            <PipelineFiltersBar value={filters} onChange={applyFilters} />
          </section>

          <section aria-label="Results" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {rows.length} of {total} quotes
                {isGenerating ? (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs">
                    <Loader2 className="size-3 animate-spin" /> generating PDF…
                  </span>
                ) : null}
              </p>
              {isAdmin ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Columns3 className="mr-1 size-4" /> Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Admin columns</DropdownMenuLabel>
                    {ADMIN_COLUMNS.map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={adminColumns[col.id]}
                        onCheckedChange={(checked) => setColumn(col.id, Boolean(checked))}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {col.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>

            {quotes.isError ? (
              <Card>
                <CardContent className="space-y-3 py-10 text-center">
                  <p className="text-sm font-medium">Failed to load pipeline data</p>
                  <p className="text-sm text-muted-foreground">
                    {quotes.error instanceof Error && quotes.error.message
                      ? quotes.error.message
                      : "Please try again"}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => void quotes.refetch()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <PipelineTable
                  rows={rows}
                  catalog={catalog.data ?? []}
                  isLoading={quotes.isLoading || catalog.isLoading}
                  isAdmin={isAdmin}
                  adminColumns={adminColumns}
                  sort={sort}
                  onSortChange={applySort}
                  onViewHistory={setHistoryQuoteId}
                  onDownloadPdf={downloadPdf}
                  isDownloading={isGenerating}
                  onResetFilters={resetFilters}
                />

                {pageCount > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Page {page + 1} of {pageCount}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => goToPage(0)}
                      >
                        First
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 0}
                        onClick={() => goToPage(page - 1)}
                      >
                        Prev
                      </Button>
                      {pageWindow(page, pageCount).map((p) => (
                        <Button
                          key={p}
                          variant={p === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => goToPage(p)}
                        >
                          {p + 1}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= pageCount - 1}
                        onClick={() => goToPage(page + 1)}
                      >
                        Next
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= pageCount - 1}
                        onClick={() => goToPage(pageCount - 1)}
                      >
                        Last
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      )}

      {historyQuoteId ? (
        <VersionHistorySheet
          quoteId={historyQuoteId}
          open
          onOpenChange={(open) => {
            if (!open) setHistoryQuoteId(null);
          }}
        />
      ) : null}
    </div>
  );
}
