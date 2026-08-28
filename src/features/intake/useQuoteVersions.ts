import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { snapshotChangeType, type VersionChangeType } from "@/lib/version-snapshot";

export interface QuoteVersionEntry {
  id: string;
  versionNumber: number;
  changeReason: string | null;
  changedAt: string;
  changeType: VersionChangeType | null;
  authorLabel: string;
  snapshot: unknown;
}

/**
 * All audit-trail snapshots for a quote, newest first.
 *
 * Reads go through `public.quote_versions_scoped()`, which strips pricing keys
 * out of the snapshot jsonb for roles that must not see them. PostgREST cannot
 * embed related rows on a set-returning function, so author profiles are
 * resolved with a second, separate query.
 */
export function useQuoteVersions(quoteId: string, enabled = true) {
  return useQuery({
    queryKey: ["quote-versions", quoteId],
    enabled: enabled && Boolean(quoteId),
    queryFn: async (): Promise<QuoteVersionEntry[]> => {
      const { data, error } = await supabase
        .rpc("quote_versions_scoped")
        .select("*")
        .eq("quote_id", quoteId)
        .order("version_number", { ascending: false });
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as unknown as Record<string, unknown>[];
      const authorIds = Array.from(
        new Set(rows.map((r) => r["changed_by"]).filter((id): id is string => Boolean(id))),
      );

      const authors = new Map<string, { email?: string | null; full_name?: string | null }>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name, role")
          .in("id", authorIds);
        for (const profile of profiles ?? []) {
          authors.set(profile.id, profile);
        }
      }

      return rows.map((record) => {
        const changedBy = record["changed_by"] as string | null;
        const profile = changedBy ? authors.get(changedBy) : undefined;
        return {
          id: String(record["id"]),
          versionNumber: Number(record["version_number"]),
          changeReason: (record["change_reason"] as string | null) ?? null,
          changedAt: String(record["changed_at"]),
          changeType: snapshotChangeType(record["snapshot"]),
          authorLabel: profile?.full_name || profile?.email || "Unknown user",
          snapshot: record["snapshot"],
        };
      });
    },
  });
}
