import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "./quote-mapper";
import type { Quote } from "@/types/quote";
import type { WorkflowAction } from "@/lib/quote-workflow";

/** Applies a pipeline transition (submit, review, approve, send, close). */
export function useQuoteTransition(quoteId: string, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: WorkflowAction): Promise<Quote> => {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { state: action.next };

      switch (action.action) {
        case "submit_for_review":
          patch["submitted_at"] = now;
          break;
        case "start_review":
        case "mark_adjusted":
          if (userId) patch["reviewed_by"] = userId;
          break;
        case "approve":
          patch["approved_at"] = now;
          if (userId) patch["approved_by"] = userId;
          break;
        case "send_to_customer":
          patch["sent_at"] = now;
          break;
        default:
          break;
      }

      const { data, error } = await supabase
        .from("quotes")
        .update(patch)
        .eq("id", quoteId)
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      return rowToQuote(data);
    },
    onSuccess: (quote, action) => {
      queryClient.setQueryData(["quote", quote.id], quote);
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(`${action.label} complete`);
    },
    onError: (error) => {
      toast.error("Could not update this quote", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
}
