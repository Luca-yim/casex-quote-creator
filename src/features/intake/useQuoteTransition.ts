import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "./quote-mapper";
import type { Quote } from "@/types/quote";
import type { Database } from "@/lib/database.types";
import type { WorkflowAction, QuoteAction } from "@/lib/quote-workflow";
import { describeQuoteWriteError } from "@/lib/supabase-errors";
import { writeVersionSnapshot, type VersionChangeType } from "@/lib/version-snapshot";
import type { AppRole } from "@/lib/auth";

const CHANGE_TYPES: Record<QuoteAction, VersionChangeType> = {
  submit_for_review: "submit",
  start_review: "claim",
  mark_adjusted: "adjust",
  approve: "approve",
  return_to_sales: "return",
  send_to_customer: "send",
  mark_accepted: "accept",
  mark_declined: "decline",
};

export interface TransitionInput {
  action: WorkflowAction;
  /** Current quote, snapshotted into the audit trail. */
  quote: Quote;
  /** Display name of the acting user, used in the change reason. */
  actorName: string;
  actorRole?: AppRole | null;
  /** Required when returning a quote to the requester. */
  note?: string;
}

function changeReason(input: TransitionInput): string {
  const who = input.actorName;
  switch (input.action.action) {
    case "submit_for_review":
      return `Submitted for estimator review by ${who}`;
    case "start_review":
      return `Estimator ${who} claimed for review`;
    case "mark_adjusted":
      return `Estimator ${who} saved pricing adjustments`;
    case "approve":
      return `Approved by estimator ${who}`;
    case "return_to_sales":
      return `Returned by estimator ${who}. Reason: ${input.note ?? "(no note)"}`;
    case "send_to_customer":
      return `Sent to customer by ${who}`;
    case "mark_accepted":
      return `Marked accepted by ${who}`;
    default:
      return `Marked declined by ${who}`;
  }
}

/** Applies a pipeline transition and records a version snapshot. */
export function useQuoteTransition(quoteId: string, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TransitionInput): Promise<Quote> => {
      const { action } = input;
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

      if (error) {
        throw Object.assign(new Error(error.message), {
          code: error.code,
          nextState: action.next,
        });
      }

      const updated = rowToQuote(data);

      // Return notes are visible to whoever requested the quote.
      if (action.action === "return_to_sales" && input.note && userId) {
        const { error: commentError } = await supabase.from("quote_comments").insert({
          quote_id: quoteId,
          author_id: userId,
          author_role: input.actorRole ?? "estimator",
          body: input.note,
          visibility: updated.ownerId ? "sales_rep_visible" : "external_visible",
        });
        if (commentError) {
          toast.warning("Return note could not be saved", {
            description: commentError.message,
          });
        }
      }

      try {
        await writeVersionSnapshot({
          quoteId,
          quoteData: updated,
          changeReason: changeReason(input),
          changedBy: userId,
          changeType: CHANGE_TYPES[action.action],
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
    onSuccess: (quote, input) => {
      queryClient.setQueryData(["quote", quote.id], quote);
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["quote-versions", quote.id] });
      void queryClient.invalidateQueries({ queryKey: ["quote-comments", quote.id] });
      toast.success(`${input.action.label} complete`);
    },
    onError: (error) => {
      const nextState = (error as { nextState?: Quote["state"] })?.nextState;
      toast.error("Could not update this quote", {
        description: describeQuoteWriteError(error, nextState),
      });
    },
  });
}
