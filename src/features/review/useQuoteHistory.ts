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
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .in("state", HISTORY_STATES as unknown as string[])
        .order("updated_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToQuote);
    },
  });
}
