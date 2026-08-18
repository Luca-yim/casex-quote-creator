import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "@/features/intake/quote-mapper";
import type { Quote } from "@/types/quote";

/** States that belong to the estimator queue. */
export const REVIEW_QUEUE_STATES = [
  "submitted_for_review",
  "under_review",
  "estimator_adjusted",
] as const;

/**
 * Fetches the whole estimator review queue.
 *
 * Deliberately unfiltered by `owner_id` / `requested_by`: estimators review
 * every submitted quote, not just their own. Row visibility is enforced by the
 * RLS SELECT policy on `quotes`.
 */
export function useReviewQueue(role?: string | null) {
  return useQuery({
    queryKey: ["quotes", "review-queue"],
    queryFn: async (): Promise<Quote[]> => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .in("state", REVIEW_QUEUE_STATES as unknown as string[])
        .order("submitted_at", { ascending: true, nullsFirst: false });

      console.debug("[review-queue] query result:", data);
      console.debug("[review-queue] error:", error);
      console.debug("[review-queue] current role:", role);

      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToQuote);
    },
  });
}
