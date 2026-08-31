import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { ComplexityTier } from "@/lib/pricing-engine/complexity";
import type { BallparkSizingRow } from "@/lib/pricing-engine/ballpark";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Reads `ballpark_sizing_reference` for a single tier.
 *
 * The real table holds one row per tier (1-4) with both program bands as
 * columns on the same row, so the lookup is `where tier = :tier` and the
 * program band is picked from the row's columns downstream.
 *
 * The query is gated on the signed-in role being estimator or admin, not on
 * the route alone: `IntakePage` is shared with sales-rep routes, so a role
 * check here keeps the request from ever firing for other roles even if the
 * card were rendered somewhere else later. RLS remains the real boundary.
 */
export function useBallparkSizingReference(tier: ComplexityTier | null) {
  const { role, loading, profileLoading } = useAuth();
  const allowed = role === "estimator" || role === "admin";
  return useQuery({
    queryKey: ["ballpark-sizing-reference", tier],
    enabled: !loading && !profileLoading && allowed && tier !== null,
    staleTime: FIVE_MINUTES,
    queryFn: async (): Promise<BallparkSizingRow[]> => {
      const { data, error } = await supabase
        .from("ballpark_sizing_reference")
        .select("*")
        .eq("tier", tier as ComplexityTier);

      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        tier: Number(row.tier) as ComplexityTier,
        tier_label: row.tier_label,
        hours_low: Number(row.hours_low),
        hours_high: Number(row.hours_high),
        commercial_rate_low: Number(row.commercial_rate_low),
        commercial_rate_high: Number(row.commercial_rate_high),
        public_sector_rate_low: Number(row.public_sector_rate_low),
        public_sector_rate_high: Number(row.public_sector_rate_high),
      }));
    },
  });
}
