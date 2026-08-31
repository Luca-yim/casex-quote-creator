import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { BallparkSizingRow } from "@/lib/pricing-engine/ballpark";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Reads `ballpark_sizing_reference`.
 *
 * The query is gated on the signed-in role being estimator or admin, not on
 * the route alone: `IntakePage` is shared with sales-rep routes, so a
 * role check here keeps the request from ever firing for other roles even if
 * the card were rendered somewhere else later. RLS remains the real boundary.
 */
export function useBallparkSizingReference() {
  const { role, loading, profileLoading } = useAuth();
  const allowed = role === "estimator" || role === "admin";
  return useQuery({
    queryKey: ["ballpark-sizing-reference"],
    enabled: !loading && !profileLoading && allowed,
    staleTime: FIVE_MINUTES,
    queryFn: async (): Promise<BallparkSizingRow[]> => {
      const { data, error } = await supabase
        // Table is not in the generated types yet (it lives in the app
        // Supabase project's pricing schema); the shape is validated below.
        .from("ballpark_sizing_reference" as never)
        .select("tier, program_type, hours_low, hours_high, rate_low, rate_high");

      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
        tier: Number(row["tier"]) as BallparkSizingRow["tier"],
        program_type: row["program_type"] as BallparkSizingRow["program_type"],
        hours_low: Number(row["hours_low"]),
        hours_high: Number(row["hours_high"]),
        rate_low: Number(row["rate_low"]),
        rate_high: Number(row["rate_high"]),
      }));
    },
  });
}
