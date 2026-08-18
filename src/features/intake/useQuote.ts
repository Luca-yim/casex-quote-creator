import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "./quote-mapper";
import type { Quote } from "@/types/quote";

/** Fetches a single quote by id and maps it to the domain shape. */
export function useQuoteById(quoteId: string | undefined) {
  return useQuery({
    queryKey: ["quote", quoteId],
    enabled: Boolean(quoteId),
    queryFn: async (): Promise<Quote> => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Quote not found");
      return rowToQuote(data);
    },
  });
}

/** Creates a new draft quote owned by the current user. */
export function useCreateDraftQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { name?: string }): Promise<Quote> => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Not signed in");
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from("quotes")
        .insert({
          name: input?.name ?? "Untitled quote",
          owner_id: userId,
          requested_by: userId,
          state: "draft",
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return rowToQuote(data);
    },
    onSuccess: (quote) => {
      queryClient.setQueryData(["quote", quote.id], quote);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
  });
}
