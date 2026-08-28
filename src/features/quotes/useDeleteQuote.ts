import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { devLog } from "@/lib/debug-log";
import { isPermissionError } from "@/lib/supabase-errors";
import { quoteDetailKey } from "@/features/intake/useQuote";
import type { Quote } from "@/types/quote";
import type { AppRole } from "@/lib/auth";

/**
 * A draft may only be deleted by the person who requested it (or an admin),
 * and only while it is still a draft that has never entered review. Anything
 * that reached an estimator is part of the audit trail and must be archived
 * through the workflow instead.
 */
export function canDeleteDraft(
  quote: Pick<Quote, "state" | "requestedBy" | "submittedAt">,
  userId: string | undefined,
  role: AppRole | null,
): boolean {
  if (quote.state !== "draft") return false;
  if (quote.submittedAt) return false;
  if (role === "admin") return true;
  return Boolean(userId) && quote.requestedBy === userId;
}

/** Permanently deletes a draft quote and refreshes every list that showed it. */
export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      // PostgREST DELETE returns no body by default, so an RLS-filtered
      // zero-row delete looks identical to success. `count: "exact"` reports
      // the number of affected rows without a RETURNING clause — the base
      // table grants no SELECT, so `.select()` would fail outright.
      const { count, error } = await supabase
        .from("quotes")
        .delete({ count: "exact" })
        .eq("id", quoteId)
        .eq("state", "draft");
      devLog("[delete-quote] count:", count, "error:", error);
      if (error) throw error;
      if (!count) {
        throw new Error(
          "Unable to delete this draft. It may have been submitted for review, deleted already, or you may not have permission.",
        );
      }
      return quoteId;
    },


    onSuccess: (quoteId) => {
      queryClient.removeQueries({ queryKey: quoteDetailKey(quoteId) });
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast.success("Draft deleted");
    },
    onError: (error: unknown) => {
      const err = error as { code?: string; message?: string } | null;
      if (isPermissionError(error)) {
        toast.error(
          "Your account isn't allowed to delete this draft. Ask an administrator to enable draft deletion.",
        );
        return;
      }
      // 23503 = foreign key violation: dependent rows (versions, PDFs, notifications).
      if (err?.code === "23503") {
        toast.error(
          "This draft has linked history records and can't be deleted. Archive it instead.",
        );
        return;
      }
      toast.error(err?.message || "Could not delete this draft.");
    },
  });
}
