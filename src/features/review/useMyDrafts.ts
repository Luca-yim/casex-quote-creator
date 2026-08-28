import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { rowToQuote } from "@/features/intake/quote-mapper";
import type { Quote } from "@/types/quote";

/**
 * Drafts authored by the signed-in internal user (estimator / admin).
 *
 * RLS already restricts drafts to their creator; the filter keeps the payload
 * tight and the ordering "most recently touched first".
 */
export function useMyDrafts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["quotes", "my-drafts", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Quote[]> => {
      // NOTE: `quotes_scoped()` is SECURITY DEFINER and therefore bypasses RLS.
      // Any future change to the RLS policies on `public.quotes` must be
      // mirrored in the function's WHERE clause in Supabase — the function does
      // not inherit policy changes automatically.
      const { data, error } = await supabase
        .rpc("quotes_scoped")
        .select("*")
        .eq("requested_by", user!.id)
        .eq("state", "draft")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(rowToQuote);
    },
  });
}
