import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { snapshotChangeType } from "@/lib/version-snapshot";
import {
  extractPricingSnapshot,
  type ProposalPricingSnapshot,
} from "@/lib/pricing-engine/proposalSnapshot";

/**
 * The pricing snapshot captured when a Proposal was approved, newest first.
 *
 * Reads go through the same `public.quote_versions_scoped()` path the version
 * history uses, so role-based stripping applies here too.
 */
export function useApprovedPricingSnapshot(
  quoteId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["approved-pricing-snapshot", quoteId],
    enabled: enabled && Boolean(quoteId),
    queryFn: async (): Promise<ProposalPricingSnapshot | null> => {
      const { data, error } = await supabase
        .rpc("quote_versions_scoped")
        .select("*")
        .eq("quote_id", quoteId)
        .order("version_number", { ascending: false });
      if (error) throw new Error(error.message);

      for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
        if (snapshotChangeType(row["snapshot"]) !== "approve") continue;
        const extracted = extractPricingSnapshot(row["snapshot"]);
        if (extracted) return extracted;
      }
      return null;
    },
  });
}
