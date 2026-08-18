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

/** All audit-trail snapshots for a quote, newest first. */
export function useQuoteVersions(quoteId: string, enabled = true) {
  return useQuery({
    queryKey: ["quote-versions", quoteId],
    enabled: enabled && Boolean(quoteId),
    queryFn: async (): Promise<QuoteVersionEntry[]> => {
      const { data, error } = await supabase
        .from("quote_versions")
        .select("*, changed_by_profile:profiles(id, email, full_name, role)")
        .eq("quote_id", quoteId)
        .order("version_number", { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        const profile = record["changed_by_profile"] as
          | { email?: string | null; full_name?: string | null }
          | null;
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
