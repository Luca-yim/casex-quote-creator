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
import { formatRelativeTime } from "@/lib/utils";
import { contactLabel } from "@/features/pipeline/usePipelineQuotes";
import { LeadRowActions } from "./LeadRowActions";
import type { LeadQueueRow } from "./useLeadQueue";
import { LEAD_STATUS_LABELS, type LeadSort, type LeadSortColumn } from "./types";

const STATUS_TONE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  claimed: "bg-amber-100 text-amber-900",
  qualified: "bg-emerald-100 text-emerald-800",
  disqualified: "bg-destructive/10 text-destructive",
  duplicate: "bg-muted text-muted-foreground",
  converted_to_ballpark: "bg-emerald-600 text-white",
};

function SortHeader({
  column,
  label,
  sort,
  onSortChange,
  className,
}: {
  column: LeadSortColumn;
  label: string;
  sort: LeadSort;
  onSortChange: (sort: LeadSort) => void;
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

/** Lead queue table. Sorting happens entirely in the database. */
export function LeadQueueTable({
  rows,
  isLoading,
  sort,
  onSortChange,
  onResetFilters,
}: {
  rows: LeadQueueRow[];
  isLoading: boolean;
  sort: LeadSort;
  onSortChange: (sort: LeadSort) => void;
  onResetFilters: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border py-12 text-center">
        <p className="text-sm font-medium">No leads match these filters</p>
        <Button variant="outline" size="sm" onClick={onResetFilters}>
          Reset filters
        </Button>
      </div>
    );
  }

  const leads = rows.map((r) => r.lead);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lead</TableHead>
            <SortHeader
              column="organization_name"
              label="Organization"
              sort={sort}
              onSortChange={onSortChange}
            />
            <TableHead>Contact</TableHead>
            <SortHeader column="status" label="Status" sort={sort} onSortChange={onSortChange} />
            <SortHeader column="lead_score" label="Score" sort={sort} onSortChange={onSortChange} />
            <TableHead>Assigned rep</TableHead>
            <TableHead>Claimed by</TableHead>
            <SortHeader
              column="submitted_at"
              label="Submitted"
              sort={sort}
              onSortChange={onSortChange}
            />
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ lead, assignedRep, claimedByProfile }) => (
            <TableRow key={lead.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {lead.leadNumber ?? "—"}
              </TableCell>
              <TableCell className="font-medium">{lead.organizationName}</TableCell>
              <TableCell>
                <div className="text-sm">{lead.contactName}</div>
                <div className="text-xs text-muted-foreground">{lead.contactEmail}</div>
              </TableCell>
              <TableCell>
                <Badge className={STATUS_TONE[lead.status] ?? ""} variant="secondary">
                  {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {lead.leadScore ?? "—"}
                {lead.leadScoreLabel ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {lead.leadScoreLabel}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-sm">{contactLabel(assignedRep)}</TableCell>
              <TableCell className="text-sm">
                {contactLabel(claimedByProfile, "—")}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {lead.submittedAt ? formatRelativeTime(lead.submittedAt) : "—"}
              </TableCell>
              <TableCell>
                <LeadRowActions
                  lead={lead}
                  otherLeads={leads.filter((l) => l.id !== lead.id)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
