import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "./quote-mapper";
import type { Quote } from "@/types/quote";

/**
 * Submits a draft quote for estimator review and records a version snapshot
 * in `quote_versions`.
 */
export function useSubmitQuote(quoteId: string, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quote: Quote): Promise<Quote> => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("quotes")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ state: "submitted_for_review", submitted_at: now } as any)
        .eq("id", quoteId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const { count } = await supabase
        .from("quote_versions")
        .select("id", { count: "exact", head: true })
        .eq("quote_id", quoteId);

      const { error: versionError } = await supabase
        .from("quote_versions")
        .insert({
          quote_id: quoteId,
          version_number: (count ?? 0) + 1,
          snapshot: { ...quote, state: "submitted_for_review", submittedAt: now },
          change_reason: "Submitted for estimator review",
          changed_by: userId ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      // A snapshot failure must not lose the submission itself.
      if (versionError) console.warn("[quote-submit] snapshot failed:", versionError.message);

      return rowToQuote(data);
    },
    onSuccess: (quote) => {
      queryClient.setQueryData(["quote", quote.id], quote);
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(
        "Submitted for review. You'll be notified when the pricing team has reviewed it.",
      );
    },
    onError: (error) => {
      toast.error("Could not submit this quote", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
}
