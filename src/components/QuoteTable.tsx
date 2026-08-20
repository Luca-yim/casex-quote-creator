import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  getQuoteColumn,
  QUOTE_STATE_DISPLAY,
  type QuoteColumnContext,
  type QuoteRowData,
} from "@/lib/columns/quoteColumns";
import type { QuoteState } from "@/types/quote";

export type QuoteTableSort = { key: string; direction: "asc" | "desc" };

type Props = {
  quotes: QuoteRowData[];
  visibleColumns: string[];
  onRowClick?: (row: QuoteRowData) => void;
  profilesMap?: Record<string, string>;
  loading?: boolean;
  emptyMessage?: string;
  defaultSort?: QuoteTableSort;
  className?: string;
};

function compare(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return 1; // nulls last
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean")
    return Number(a) - Number(b);
  const as = String(a);
  const bs = String(b);
  const ad = Date.parse(as);
  const bd = Date.parse(bs);
  if (!Number.isNaN(ad) && !Number.isNaN(bd) && /\d{4}-\d{2}-\d{2}/.test(as)) {
    return ad - bd;
  }
  return as.localeCompare(bs);
}

/**
 * Reusable, sortable quote table driven by the shared column definitions in
 * `@/lib/columns/quoteColumns`. Sorting is local to the component.
 */
export function QuoteTable({
  quotes,
  visibleColumns,
  onRowClick,
  profilesMap,
  loading = false,
  emptyMessage = "No quotes to show.",
  defaultSort,
  className,
}: Props) {
  const [sort, setSort] = useState<QuoteTableSort | null>(defaultSort ?? null);

  const columns = useMemo(
    () => visibleColumns.map((key) => getQuoteColumn(key)),
    [visibleColumns],
  );

  const ctx: QuoteColumnContext = { profilesMap };

  const rows = useMemo(() => {
    if (!sort) return quotes;
    const col = getQuoteColumn(sort.key);
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...quotes].sort(
      (a, b) => compare(col.accessor(a), col.accessor(b)) * factor,
    );
  }, [quotes, sort]);

  const toggleSort = (key: string) => {
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  return (
    <div className={cn("overflow-x-auto rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={col.align === "right" ? "text-right" : undefined}
              >
                {col.sortable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-7 px-2"
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                    {sort?.key === col.key ? (
                      sort.direction === "asc" ? (
                        <ArrowUp className="ml-1 size-3" />
                      ) : (
                        <ArrowDown className="ml-1 size-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="ml-1 size-3 opacity-40" />
                    )}
                  </Button>
                ) : (
                  col.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                role={onRowClick ? "link" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={
                  onRowClick
                    ? `Open ${row.customerName || row.name || "Untitled quote"}`
                    : undefined
                }
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                className={
                  onRowClick
                    ? "cursor-pointer focus-visible:bg-muted/40 focus-visible:outline-none"
                    : undefined
                }
              >
                {columns.map((col) => {
                  const value = col.accessor(row);
                  const display = col.format
                    ? col.format(value, row, ctx)
                    : value === null || value === undefined || value === ""
                      ? "—"
                      : String(value);

                  return (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.align === "right" && "text-right tabular-nums",
                        col.type === "currency" && "font-mono",
                      )}
                    >
                      {col.type === "state" ? (
                        <Badge
                          variant="secondary"
                          className={
                            QUOTE_STATE_DISPLAY[value as QuoteState]?.className
                          }
                        >
                          {display}
                        </Badge>
                      ) : (
                        display
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
