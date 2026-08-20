import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { rowToQuote } from "@/features/intake/quote-mapper";
import { quoteSelectForRole } from "@/lib/quote-columns";
import type { Quote } from "@/types/quote";

export type MyQuotesTab = "submitted" | "drafts";

const SUBMITTED_STATES = [
  "submitted_for_review",
  "under_review",
  "estimator_adjusted",
  "approved",
  "sent_to_customer",
  "accepted",
  "declined",
  "archived",
];

/**
 * Quotes belonging to the signed-in user, split by tab.
 *
 * RLS already scopes rows to the requester/owner; the client filter keeps the
 * payload small and the ordering tab-appropriate (newest submission first for
 * submitted work, most recently touched first for drafts).
 */
export function useMyQuotes(tab: MyQuotesTab) {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ["quotes", "my-quotes", tab, user?.id, role],
    queryFn: async (): Promise<Quote[]> => {
      if (!user) throw new Error("Not authenticated");

      let query = supabase
        .from("quotes")
        .select(quoteSelectForRole(role))
        .or(`requested_by.eq.${user.id},owner_id.eq.${user.id}`);

      query =
        tab === "drafts"
          ? query.eq("state", "draft").order("updated_at", { ascending: false })
          : query.in("state", SUBMITTED_STATES).order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => rowToQuote(row as never));
    },
    enabled: Boolean(user),
  });
}
