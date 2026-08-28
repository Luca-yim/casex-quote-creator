import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "@/features/intake/quote-mapper";
import type { Quote } from "@/types/quote";
import type { Database } from "@/lib/database.types";
import { PAGE_SIZE, effectiveStates, type PipelineFilters, type PipelineSort } from "./types";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];

/** Minimal person reference resolved through a profiles foreign key embed. */
export interface ContactRef {
  id: string;
  email: string | null;
  name: string | null;
}

export interface PipelineRow {
  quote: Quote;
  owner: ContactRef | null;
  estimator: ContactRef | null;
  requester: ContactRef | null;
}

export interface PipelineQuotesResult {
  rows: PipelineRow[];
  count: number;
}

const EMBED = `
  *,
  owner:profiles!quotes_owner_id_fkey(id, email, full_name),
  estimator:profiles!quotes_approved_by_fkey(id, email, full_name),
  requester:profiles!quotes_requested_by_fkey(id, email, full_name)
`;

type EmbeddedProfile = { id: string; email: string | null; full_name: string | null } | null;

function toContact(value: unknown): ContactRef | null {
  const p = (Array.isArray(value) ? value[0] : value) as EmbeddedProfile;
  if (!p) return null;
  return { id: p.id, email: p.email, name: p.full_name };
}

/** Display label for a contact, falling back to the email then a placeholder. */
export function contactLabel(contact: ContactRef | null, fallback = "Unassigned"): string {
  if (!contact) return fallback;
  return contact.name || contact.email || fallback;
}

/**
 * Escapes user input before it is interpolated into a PostgREST `or` filter.
 * `%` and `_` are ilike wildcards; commas and parentheses break the filter
 * grammar, so they are dropped rather than escaped.
 */
export function sanitizeSearch(input: string): string {
  return input
    .trim()
    .replace(/[,()*"\\]/g, " ")
    .replace(/[%_]/g, (m) => `\\${m}`)
    .slice(0, 100);
}

/** Maps a UI sort column onto a real database column. */
function dbSort(sort: PipelineSort): { column: string; ascending: boolean } {
  switch (sort.column) {
    case "customer_name":
      return { column: "customer_name", ascending: sort.direction === "asc" };
    // Days since approved is the inverse ordering of approved_at.
    case "days_since_approved":
      return { column: "approved_at", ascending: sort.direction !== "asc" };
    // TCV is computed client-side; keep a stable server order and sort the page.
    case "tcv":
    case "approved_at":
    default:
      return { column: "approved_at", ascending: sort.direction === "asc" };
  }
}

/**
 * Paginated pipeline query. Row-level visibility is enforced by the
 * `estimator_reads_all_quotes` RLS policy (estimator/admin only); the UI guard
 * is defense-in-depth, not the primary control.
 */
export function usePipelineQuotes({
  filters,
  page,
  sort,
  enabled = true,
}: {
  filters: PipelineFilters;
  page: number;
  sort: PipelineSort;
  enabled?: boolean;
}) {
  return useQuery<PipelineQuotesResult>({
    queryKey: ["pipeline", filters, page, sort],
    enabled,
    staleTime: 60_000,
    gcTime: 300_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const order = dbSort(sort);
      // NOTE: `quotes_scoped()` is SECURITY DEFINER and therefore bypasses RLS.
      // Any future change to the RLS policies on `public.quotes` must be
      // mirrored in the function's WHERE clause in Supabase — the function does
      // not inherit policy changes automatically.
      let query = supabase
        .rpc("quotes_scoped", {}, { count: "exact" })
        .select(EMBED)
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

      const { data, count, error } = await query
        .order(order.column, { ascending: order.ascending, nullsFirst: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw new Error(error.message);

      const rows: PipelineRow[] = ((data ?? []) as unknown as Array<
        QuoteRow & Record<string, unknown>
      >).map((row) => ({
        quote: rowToQuote(row),
        owner: toContact(row["owner"]),
        estimator: toContact(row["estimator"]),
        requester: toContact(row["requester"]),
      }));

      return { rows, count: count ?? rows.length };
    },
  });
}
