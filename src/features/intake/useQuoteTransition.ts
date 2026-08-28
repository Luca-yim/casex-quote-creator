import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quoteDetailKey } from "./useQuote";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

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
  /** Sales rep to own the quote after approval (estimator assignment). */
  assignRepId?: string | null;
  assignRepName?: string | null;
  /** Display name of the rep who owned the quote before reassignment. */
  previousRepName?: string | null;
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
    case "approve": {
      const base = `Approved by estimator ${who}`;
      if (!input.assignRepName) return base;
      const reassigned =
        input.previousRepName && input.previousRepName !== input.assignRepName;
      return reassigned
        ? `${base}, assigned to ${input.assignRepName} (reassigned from ${input.previousRepName} to ${input.assignRepName})`
        : `${base}, assigned to ${input.assignRepName}`;
    }
    case "return_to_sales":
      return `Returned for edit: ${input.note ?? "(no note)"}`;
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
      // State itself is never written through the table: `transition_quote()`
      // owns the state machine (and its RLS/`WITH CHECK` rules). Only the
      // accompanying stamps go through the ordinary UPDATE path.
      const stamps: Record<string, unknown> = {};
      // Mirrors the write in domain shape. The Data API no longer returns the
      // updated row (SELECT on `public.quotes` is revoked so pricing columns
      // can only leave through `quotes_scoped()`), so the client derives the
      // post-write quote instead of reading the server echo.
      const applied: Partial<Quote> = { state: action.next, updatedAt: now };

      switch (action.action) {
        case "submit_for_review":
          stamps["submitted_at"] = now;
          applied.submittedAt = now;
          break;
        case "start_review":
        case "mark_adjusted":
          if (userId) {
            stamps["reviewed_by"] = userId;
            applied.reviewedBy = userId;
          }
          break;
        case "approve":
          stamps["approved_at"] = now;
          applied.approvedAt = now;
          if (userId) {
            stamps["approved_by"] = userId;
            applied.approvedBy = userId;
          }
          if (input.assignRepId && input.assignRepId !== input.quote.ownerId) {
            stamps["owner_id"] = input.assignRepId;
            applied.ownerId = input.assignRepId;
          }
          break;
        case "return_to_sales":
          // Hand the quote to the rep who will rework it. Approval/sent
          // stamps are deliberately left untouched.
          if (input.assignRepId) {
            stamps["owner_id"] = input.assignRepId;
            applied.ownerId = input.assignRepId;
          }
          if (userId) {
            stamps["reviewed_by"] = userId;
            stamps["last_reviewed_by"] = userId;
            applied.reviewedBy = userId;
            applied.lastReviewedBy = userId;
          }

          break;
        case "send_to_customer":
          stamps["sent_at"] = now;
          applied.sentAt = now;
          break;
        default:
          break;
      }

      if (Object.keys(stamps).length > 0) {
        const { error: stampError } = await supabase
          .from("quotes")
          .update(stamps as Database["public"]["Tables"]["quotes"]["Update"])
          .eq("id", quoteId);
        if (stampError) {
          throw Object.assign(new Error(stampError.message), {
            code: stampError.code,
            nextState: action.next,
          });
        }
      }

      const { error } = await supabase.rpc("transition_quote", {
        p_quote_id: quoteId,
        p_new_state: action.next,
      });

      if (error) {
        throw Object.assign(new Error(error.message), {
          code: error.code,
          nextState: action.next,
        });
      }


      const updated: Quote = { ...input.quote, ...applied };


      // Return notes are visible to whoever requested the quote.
      if (action.action === "return_to_sales" && input.note && userId) {
        const { error: commentError } = await supabase.from("quote_comments").insert({
          quote_id: quoteId,
          author_id: userId,
          author_role: input.actorRole ?? "estimator",
          body: input.note,
          visibility: "sales_rep_visible",
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
      queryClient.setQueriesData({ queryKey: quoteDetailKey(quoteId) }, quote);
      void queryClient.invalidateQueries({ queryKey: quoteDetailKey(quoteId) });
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      void queryClient.invalidateQueries({ queryKey: ["quote-versions", quoteId] });
      void queryClient.invalidateQueries({ queryKey: ["quote-comments", quoteId] });
      if (input.action.action === "approve") {
        toast.success(
          `Quote approved and sent to ${input.assignRepName ?? "the sales rep"}`,
        );
      } else if (input.action.action === "return_to_sales") {
        toast.success(`Quote returned to ${input.assignRepName ?? "the sales rep"}`);
      } else {
        toast.success(`${input.action.label} complete`);
      }
    },
    onError: (error) => {
      const nextState = (error as { nextState?: Quote["state"] })?.nextState;
      toast.error("Could not update this quote", {
        description: describeQuoteWriteError(error, nextState),
      });
    },
  });
}
