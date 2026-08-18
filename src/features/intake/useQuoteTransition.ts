import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "./quote-mapper";
import type { Quote } from "@/types/quote";
import type { Database } from "@/lib/database.types";
import type { WorkflowAction } from "@/lib/quote-workflow";
import { describeQuoteWriteError } from "@/lib/supabase-errors";

/** Applies a pipeline transition (submit, review, approve, send, close). */
export function useQuoteTransition(quoteId: string, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: WorkflowAction): Promise<Quote> => {
      const now = new Date().toISOString();
      const patch: Database["public"]["Tables"]["quotes"]["Update"] =
        { state: action.next } as Database["public"]["Tables"]["quotes"]["Update"];

      switch (action.action) {
        case "submit_for_review":
          (patch as Record<string, unknown>)["submitted_at"] = now;
          break;
        case "start_review":
        case "mark_adjusted":
          if (userId) (patch as Record<string, unknown>)["reviewed_by"] = userId;
          break;
        case "approve":
          (patch as Record<string, unknown>)["approved_at"] = now;
          if (userId) (patch as Record<string, unknown>)["approved_by"] = userId;
          break;
        case "send_to_customer":
          (patch as Record<string, unknown>)["sent_at"] = now;
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

      if (error) throw Object.assign(new Error(error.message), { code: error.code, nextState: action.next });
      return rowToQuote(data);
    },
    onSuccess: (quote, action) => {
      queryClient.setQueryData(["quote", quote.id], quote);
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success(`${action.label} complete`);
    },
    onError: (error) => {
      const nextState = (error as { nextState?: Quote["state"] })?.nextState;
      toast.error("Could not update this quote", {
        description: describeQuoteWriteError(error, nextState),
      });
    },
  });
}
