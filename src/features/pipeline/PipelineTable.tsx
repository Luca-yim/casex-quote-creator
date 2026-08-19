import { useMemo } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calculatePricingBreakdown } from "@/lib/calculation-engine";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { PricingCatalogRow } from "@/types/pricing";
import type { PdfVersion } from "@/features/pdf-export/types";
import { PipelineRowActions } from "./PipelineRowActions";
import { contactLabel, type PipelineRow } from "./usePipelineQuotes";
import {
  STATE_LABELS,
  type AdminColumnVisibility,
  type PipelineSort,
  type SortColumn,
} from "./types";

const STATE_TONE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  sent_to_customer: "bg-blue-100 text-blue-800",
  accepted: "bg-emerald-600 text-white",
  declined: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground",
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function SortHeader({
  column,
  label,
  sort,
  onSortChange,
  className,
}: {
  column: SortColumn;
  label: string;
  sort: PipelineSort;
  onSortChange: (sort: PipelineSort) => void;
  className?: string;
}) {
  const active = sort.column === column;
  return (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 px-2"
        onClick={() =>
          onSortChange({
            column,
            direction: active && sort.direction === "desc" ? "asc" : "desc",
          })
        }
      >
        {label}
        {active ? (
          sort.direction === "asc" ? (
            <ArrowUp className="ml-1 size-3" />
          ) : (
            <ArrowDown className="ml-1 size-3" />
          )
        ) : (
          <ChevronsUpDown className="ml-1 size-3 opacity-40" />
        )}
      </Button>
    </TableHead>
  );
}

/**
 * Read-only pipeline table. Sorting for every column except TCV happens in the
 * database; TCV is computed client-side and therefore sorted within the page.
 */
export function PipelineTable({
  rows,
  catalog,
  isLoading,
  isAdmin,
  adminColumns,
  sort,
  onSortChange,
  onViewHistory,
  onDownloadPdf,
  isDownloading,
  onResetFilters,
}: {
  rows: PipelineRow[];
  catalog: PricingCatalogRow[];
  isLoading: boolean;
  isAdmin: boolean;
  adminColumns: AdminColumnVisibility;
  sort: PipelineSort;
  onSortChange: (sort: PipelineSort) => void;
  onViewHistory: (quoteId: string) => void;
  onDownloadPdf: (row: PipelineRow, version: PdfVersion) => void;
  isDownloading: boolean;
  onResetFilters: () => void;
}) {
  // TCV is memoized per quote id + updated_at so unrelated re-renders are free.
  const withTcv = useMemo(() => {
    return rows.map((row) => ({
      row,
      tcv: calculatePricingBreakdown(row.quote, catalog).finalTCV,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => `${r.quote.id}:${r.quote.updatedAt}`).join("|"), catalog]);

  const ordered = useMemo(() => {
    if (sort.column !== "tcv") return withTcv;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...withTcv].sort((a, b) => (a.tcv - b.tcv) * factor);
  }, [withTcv, sort]);

  const columnCount =
    10 + (isAdmin ? Object.values(adminColumns).filter(Boolean).length : 0);

  return (
    <div className="rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHeader
              column="customer_name"
              label="Customer"
              sort={sort}
              onSortChange={onSortChange}
            />
            <TableHead>Vertical / Solution</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>State</TableHead>
            <SortHeader
              column="tcv"
              label="TCV"
              sort={sort}
              onSortChange={onSortChange}
              className="text-right"
            />
            <TableHead className="text-right">Years</TableHead>
            <SortHeader
              column="approved_at"
              label="Approved"
              sort={sort}
              onSortChange={onSortChange}
            />
            <TableHead>Sales rep</TableHead>
            <TableHead>Estimator</TableHead>
            {isAdmin && adminColumns.requested_by ? <TableHead>Requested by</TableHead> : null}
            {isAdmin && adminColumns.days_since_approved ? (
              <SortHeader
                column="days_since_approved"
                label="Days since approved"
                sort={sort}
                onSortChange={onSortChange}
              />
            ) : null}
            {isAdmin && adminColumns.margin_percent ? (
              <TableHead className="text-right">Margin %</TableHead>
            ) : null}
            {isAdmin && adminColumns.repeatable_activation ? (
              <TableHead>Repeatable</TableHead>
            ) : null}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columnCount }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : ordered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No quotes match your filters</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={onResetFilters}>
                  Reset filters
                </Button>
              </TableCell>
            </TableRow>
          ) : (
            ordered.map(({ row, tcv }) => {
              const { quote } = row;
              const days = daysSince(quote.approvedAt);
              return (
                <TableRow
                  key={quote.id}
                  className="cursor-pointer hover:bg-muted/60"
                  onClick={() => window.open(`/review/${quote.id}`, "_blank", "noopener")}
                >
                  <TableCell className="font-medium">
                    <a
                      href={`/review/${quote.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {quote.customerName || quote.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {quote.vertical || "—"} / {quote.solution || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {quote.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATE_TONE[quote.state] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {STATE_LABELS[quote.state] ?? quote.state}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(tcv)}</TableCell>
                  <TableCell className="text-right">{quote.contractYears}</TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={quote.approvedAt ? new Date(quote.approvedAt).toLocaleString() : ""}
                  >
                    {quote.approvedAt ? formatRelativeTime(quote.approvedAt) : "—"}
                  </TableCell>
                  <TableCell>{contactLabel(row.owner)}</TableCell>
                  <TableCell>{contactLabel(row.estimator, "—")}</TableCell>
                  {isAdmin && adminColumns.requested_by ? (
                    <TableCell>{contactLabel(row.requester, "—")}</TableCell>
                  ) : null}
                  {isAdmin && adminColumns.days_since_approved ? (
                    <TableCell>{days === null ? "—" : `${days}d`}</TableCell>
                  ) : null}
                  {isAdmin && adminColumns.margin_percent ? (
                    <TableCell className="text-right font-mono">
                      {quote.marginPercent}%
                    </TableCell>
                  ) : null}
                  {isAdmin && adminColumns.repeatable_activation ? (
                    <TableCell className="capitalize text-muted-foreground">
                      {quote.repeatableActivation.replace(/_/g, " ")}
                    </TableCell>
                  ) : null}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <PipelineRowActions
                      quote={quote}
                      isDownloading={isDownloading}
                      onDownloadPdf={(version) => onDownloadPdf(row, version)}
                      onViewHistory={onViewHistory}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
