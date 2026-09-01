import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { LEAD_STATUSES, type LeadStatus } from "./types";

export type LeadStats = Record<LeadStatus, number> & { total: number };

const EMPTY: LeadStats = {
  new_lead: 0,
  claimed: 0,
  qualified: 0,
  disqualified: 0,
  duplicate: 0,
  converted_to_ballpark: 0,
  total: 0,
};

/** Hard cap on rows analysed for counts — keeps the aggregation bounded. */
export const LEAD_STATS_CAP = 2000;

/**
 * Counts of leads per status, independent of the table's filters — the cards
 * are a queue overview, mirroring `usePipelineStats`'s standalone query.
 */
export function useLeadStats({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<LeadStats>({
    queryKey: ["lead-stats"],
    enabled,
    staleTime: 30_000,
    gcTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_intakes")
        .select("status")
        .limit(LEAD_STATS_CAP);
      if (error) throw new Error(error.message);

      const stats: LeadStats = { ...EMPTY };
      for (const row of (data ?? []) as Array<{ status: string }>) {
        const status = row.status as LeadStatus;
        if ((LEAD_STATUSES as readonly string[]).includes(status)) stats[status] += 1;
        stats.total += 1;
      }
      return stats;
    },
  });
}
