import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "@/features/intake/quote-mapper";
import type { Quote } from "@/types/quote";

/** Post-approval states that no longer belong to the active review queue. */
export const HISTORY_STATES = [
  "approved",
  "sent_to_customer",
  "accepted",
  "declined",
  "archived",
] as const;

/** Quotes an estimator has already approved or that have since closed. */
export function useQuoteHistory() {
  return useQuery({
    queryKey: ["quotes", "estimator-history"],
    queryFn: async (): Promise<Quote[]> => {
      // NOTE: `quotes_scoped()` is SECURITY DEFINER and therefore bypasses RLS.
      // Any future change to the RLS policies on `public.quotes` must be
      // mirrored in the function's WHERE clause in Supabase — the function does
      // not inherit policy changes automatically.
      const { data, error } = await supabase
        .rpc("quotes_scoped")
        .select("*")
        .in("state", HISTORY_STATES as unknown as string[])
        .order("updated_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToQuote);
    },
  });
}
