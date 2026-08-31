import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { sanitizeSearch } from "@/features/pipeline/usePipelineQuotes";
import type { ContactRef } from "@/features/pipeline/usePipelineQuotes";
import { rowToLead, type Lead } from "./lead-mapper";
import { LEAD_PAGE_SIZE, type LeadFilters, type LeadSort } from "./types";

type LeadRow = Database["public"]["Tables"]["lead_intakes"]["Row"];

export interface LeadQueueRow {
  lead: Lead;
  assignedRep: ContactRef | null;
  claimedByProfile: ContactRef | null;
}

export interface LeadQueueResult {
  rows: LeadQueueRow[];
  count: number;
}

const EMBED = `
  *,
  assigned_rep:profiles!lead_intakes_assigned_rep_id_fkey(id, email, full_name),
  claimed_by_profile:profiles!lead_intakes_claimed_by_fkey(id, email, full_name)
`;

type EmbeddedProfile = { id: string; email: string | null; full_name: string | null } | null;

function toContact(value: unknown): ContactRef | null {
  const p = (Array.isArray(value) ? value[0] : value) as EmbeddedProfile;
  if (!p) return null;
  return { id: p.id, email: p.email, name: p.full_name };
}

export const leadQueueKey = (
  filters: LeadFilters,
  page: number,
  sort: LeadSort,
  userId: string | null,
) => ["lead-queue", filters, page, sort, userId] as const;

/**
 * Paginated lead queue.
 *
 * Reads the base table directly — `lead_intakes` holds no pricing-sensitive
 * columns, so RLS (`internal_reads_leads`) is the correct and only boundary;
 * a scoped RPC like `quotes_scoped()` would add nothing here.
 */
export function useLeadQueue({
  filters,
  page,
  sort,
  enabled = true,
}: {
  filters: LeadFilters;
  page: number;
  sort: LeadSort;
  enabled?: boolean;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<LeadQueueResult>({
    queryKey: leadQueueKey(filters, page, sort, userId),
    enabled,
    staleTime: 30_000,
    gcTime: 300_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("lead_intakes")
        .select(EMBED, { count: "exact" })
        .in("status", filters.statuses);

      if (filters.assignee === "unassigned") {
        query = query.is("assigned_rep_id", null).is("claimed_by", null);
      } else if (filters.assignee === "mine") {
        query = query.eq("assigned_rep_id", userId ?? "");
      } else if (filters.assignee) {
        query = query.eq("assigned_rep_id", filters.assignee);
      }

      const term = sanitizeSearch(filters.search);
      if (term) {
        query = query.or(
          `organization_name.ilike.%${term}%,contact_name.ilike.%${term}%,contact_email.ilike.%${term}%`,
        );
      }

      const { data, count, error } = await query
        .order(sort.column, { ascending: sort.direction === "asc", nullsFirst: false })
        .range(page * LEAD_PAGE_SIZE, (page + 1) * LEAD_PAGE_SIZE - 1);

      if (error) throw new Error(error.message);

      const rows: LeadQueueRow[] = ((data ?? []) as unknown as Array<
        LeadRow & Record<string, unknown>
      >).map((row) => ({
        lead: rowToLead(row),
        assignedRep: toContact(row["assigned_rep"]),
        claimedByProfile: toContact(row["claimed_by_profile"]),
      }));

      return { rows, count: count ?? rows.length };
    },
  });
}
