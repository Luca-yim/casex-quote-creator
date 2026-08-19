import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "./quote-mapper";
import type { Quote } from "@/types/quote";
import { describeQuoteWriteError } from "@/lib/supabase-errors";
import { writeVersionSnapshot } from "@/lib/version-snapshot";

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
      if (error) throw Object.assign(new Error(error.message), { code: error.code });

      try {
        await writeVersionSnapshot({
          quoteId,
          quoteData: { ...quote, state: "submitted_for_review", submittedAt: now },
          changeReason: "Submitted for estimator review",
          changedBy: userId,
          changeType: "submit",
        });
      } catch (snapshotError) {
        // The submission itself already succeeded; warn rather than lose it.
        toast.warning("Audit trail incomplete", {
          description:
            snapshotError instanceof Error
              ? snapshotError.message
              : "The version snapshot failed to save.",
        });
      }

      return rowToQuote(data);
    },
    onSuccess: (quote) => {
      queryClient.setQueriesData({ queryKey: quoteDetailKey(quote.id) }, quote);
      void queryClient.invalidateQueries({ queryKey: quoteDetailKey(quote.id) });
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(
        "Submitted for review. You'll be notified when the pricing team has reviewed it.",
      );
    },
    onError: (error) => {
      toast.error("Could not submit this quote", {
        description: describeQuoteWriteError(error, "submitted_for_review"),
      });
    },
  });
}
