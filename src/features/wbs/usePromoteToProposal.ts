import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { quoteDetailKey } from "@/features/intake/useQuote";
import { writeVersionSnapshot } from "@/lib/version-snapshot";
import { describeQuoteWriteError } from "@/lib/supabase-errors";
import type { Quote } from "@/types/quote";

export interface PromoteInput {
  quote: Quote;
  actorName: string;
}

/**
 * Promotes a quote from `ballpark` to `proposal` fidelity.
 *
 * This is deliberately NOT routed through `transition_quote()`: that RPC owns
 * the workflow state machine and expects an actual state change. Promotion
 * leaves `state` untouched (the quote stays `under_review`) and only changes
 * `tier`, so it is a direct UPDATE plus the same `quote_versions` snapshot
 * every other event writes.
 *
 * One-way by construction — there is no demotion path here.
 */
export function usePromoteToProposal(quoteId: string, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quote, actorName }: PromoteInput): Promise<Quote> => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("quotes")
        .update({ tier: "proposal", updated_at: now })
        .eq("id", quoteId);

      if (error) {
        throw Object.assign(new Error(error.message), { code: error.code });
      }

      const updated: Quote = { ...quote, tier: "proposal", updatedAt: now };

      try {
        await writeVersionSnapshot({
          quoteId,
          quoteData: updated,
          changeReason: `Converted to proposal by ${actorName}`,
          changedBy: userId,
          changeType: "promote",
        });
      } catch (snapshotError) {
        toast.warning("Audit trail incomplete", {
          description:
            snapshotError instanceof Error
              ? `The version snapshot for this step failed to save: ${snapshotError.message}`
              : "The version snapshot for this step failed to save.",
        });
      }

      return updated;
    },
    onSuccess: (quote) => {
      queryClient.setQueriesData({ queryKey: quoteDetailKey(quoteId) }, quote);
      void queryClient.invalidateQueries({ queryKey: quoteDetailKey(quoteId) });
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["quote-versions", quoteId] });
      toast.success("Converted to proposal");
    },
    onError: (error) => {
      toast.error("Could not convert this quote", {
        description: describeQuoteWriteError(error),
      });
    },
  });
}
