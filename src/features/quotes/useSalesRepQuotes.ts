import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { rowToQuote } from "@/features/intake/quote-mapper";
import type { Quote } from "@/types/quote";
import { devLog } from "@/lib/debug-log";

/**
 * Fetches every quote the current rep owns or requested.
 *
 * RLS enforces visibility server-side; the client just asks for the rows
 * associated with the signed-in user.
 */
export function useSalesRepQuotes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["quotes", "sales-rep", user?.id],
    queryFn: async (): Promise<Quote[]> => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .or(`requested_by.eq.${user.id},owner_id.eq.${user.id}`)
        .order("updated_at", { ascending: false });

      devLog("[sales-rep-quotes] result:", data);
      devLog("[sales-rep-quotes] error:", error);

      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToQuote);
    },
    enabled: Boolean(user),
  });
}
