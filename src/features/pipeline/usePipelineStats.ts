import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "@/features/intake/quote-mapper";
import { calculatePricingBreakdown } from "@/lib/calculation-engine";
import type { PricingCatalogRow } from "@/types/pricing";
import type { Database } from "@/lib/database.types";
import { effectiveStates, type PipelineFilters } from "./types";
import { sanitizeSearch } from "./usePipelineQuotes";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];

/** Hard cap on rows analysed for stats — keeps the aggregation bounded. */
export const STATS_CAP = 2000;

export interface PipelineStats {
  inPipelineCount: number;
  inPipelineTcv: number;
  wonCount: number;
  wonTcv: number;
  lostCount: number;
  lostTcv: number;
  /** 0-100, or null when there are no closed deals. */
  winRate: number | null;
  medianApprovalHours: number | null;
  /** Number of quotes with both submitted_at and approved_at. */
  approvalSampleSize: number;
  totalAnalyzed: number;
  capReached: boolean;
}

const EMPTY: PipelineStats = {
  inPipelineCount: 0,
  inPipelineTcv: 0,
  wonCount: 0,
  wonTcv: 0,
  lostCount: 0,
  lostTcv: 0,
  winRate: null,
  medianApprovalHours: null,
  approvalSampleSize: 0,
  totalAnalyzed: 0,
  capReached: false,
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Aggregated pipeline metrics for the current filter set.
 *
 * Runs independently of (and in parallel with) the paginated table query.
 * Approval timing reads `submitted_at`/`approved_at` directly — never
 * `quote_versions`, which is slower and unnecessary here.
 */
export function usePipelineStats({
  filters,
  catalog,
  enabled = true,
}: {
  filters: PipelineFilters;
  catalog: PricingCatalogRow[] | undefined;
  enabled?: boolean;
}) {
  return useQuery<PipelineStats>({
    queryKey: ["pipeline-stats", filters, Boolean(catalog?.length)],
    enabled: enabled && Boolean(catalog),
    staleTime: 60_000,
    gcTime: 300_000,
    queryFn: async () => {
      let query = supabase
        .from("quotes_scoped")
        .select("*")
        .in("state", effectiveStates(filters));

      if (filters.vertical) query = query.eq("vertical", filters.vertical);
      if (filters.solution) query = query.eq("solution", filters.solution);
      if (filters.dateFrom) query = query.gte("approved_at", filters.dateFrom);
      if (filters.dateTo) query = query.lte("approved_at", `${filters.dateTo}T23:59:59.999Z`);
      if (filters.ownerId === "unassigned") query = query.is("owner_id", null);
      else if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
      if (filters.estimatorId) query = query.eq("approved_by", filters.estimatorId);

      const term = sanitizeSearch(filters.search);
      if (term) {
        query = query.or(
          `customer_name.ilike.%${term}%,name.ilike.%${term}%,customer_email.ilike.%${term}%`,
        );
      }

      const { data, error } = await query.limit(STATS_CAP);
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as QuoteRow[];
      if (rows.length === 0) return EMPTY;

      const stats: PipelineStats = { ...EMPTY, totalAnalyzed: rows.length };
      const approvalHours: number[] = [];

      for (const row of rows) {
        const quote = rowToQuote(row);
        const tcv = calculatePricingBreakdown(quote, catalog ?? []).finalTCV;

        if (quote.state === "approved" || quote.state === "sent_to_customer") {
          stats.inPipelineCount += 1;
          stats.inPipelineTcv += tcv;
        } else if (quote.state === "accepted") {
          stats.wonCount += 1;
          stats.wonTcv += tcv;
        } else if (quote.state === "declined") {
          stats.lostCount += 1;
          stats.lostTcv += tcv;
        }

        if (quote.submittedAt && quote.approvedAt) {
          const hours =
            (new Date(quote.approvedAt).getTime() - new Date(quote.submittedAt).getTime()) /
            3_600_000;
          if (Number.isFinite(hours) && hours >= 0) approvalHours.push(hours);
        }
      }

      const closed = stats.wonCount + stats.lostCount;
      stats.winRate = closed > 0 ? (stats.wonCount / closed) * 100 : null;
      stats.medianApprovalHours = median(approvalHours);
      stats.approvalSampleSize = approvalHours.length;
      stats.capReached = rows.length >= STATS_CAP;
      return stats;
    },
  });
}
