import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth, homeRouteForRole } from "@/lib/auth";
import {
  checkMarginJustification,
  readinessCheck,
  validateQuoteForSubmission,
  MARGIN_JUSTIFICATION_MESSAGE,
} from "@/lib/quote-validation";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "./IntakeContext";
import { SaveStatus } from "./SaveStatus";
import { useSubmitQuote } from "./useSubmitQuote";
import { DeleteDraftButton } from "@/features/quotes/DeleteDraftButton";

/**
 * Sticky bottom action bar. Shows the auto-save status and an explicit
 * "Save draft" button for anyone editing, plus "Submit for Review" for
 * requesters (external / sales rep / admin) on a draft. Estimator
 * approve/return actions live in the workflow bar.
 */
export function SubmitBar() {
  const { quote, quoteId, role, mode, flushSave, updateField } = useIntake();
  const { user } = useAuth();
  const navigate = useNavigate();
  const form = useFormContext<QuoteFormData>();
  const submit = useSubmitQuote(quoteId, user?.id);
  const [savingDraft, setSavingDraft] = useState(false);

  const editable = mode === "edit";
  const isResubmit = quote.state === "estimator_adjusted";
  const canSubmit =
    ((role === "external" || role === "sales_rep" || role === "admin") &&
      quote.state === "draft") ||
    // A returned quote is resubmitted by the rep it was assigned to.
    (isResubmit &&
      (role === "admin" || (role === "sales_rep" && quote.ownerId === user?.id)));

  if (!editable && !canSubmit) return null;

  const readiness = readinessCheck(quote);
  const marginError = checkMarginJustification(quote);

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await flushSave();
      toast.success("Draft saved");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    // Auto-name unnamed drafts at the point of persistence (the input keeps
    // "Untitled Quote" as a ghosted placeholder, never a real value).
    if (!quote.name?.trim()) {
      updateField("name", "Untitled Quote");
    }
    await flushSave();
    const submissionQuote = {
      ...quote,
      name: quote.name?.trim() || "Untitled Quote",
    };
    if (checkMarginJustification(quote)) {
      toast.error("Margin justification required", {
        description: MARGIN_JUSTIFICATION_MESSAGE,
      });
      return;
    }
    const result = validateQuoteForSubmission(submissionQuote);
    if (!result.valid) {
      await form.trigger();
      const firstField = result.missingRequiredFields[0];
      if (firstField) {
        const el = document.querySelector<HTMLElement>(`[name="${firstField}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus?.();
      }
      toast.error("Some required details are missing", {
        description: "Fix the highlighted fields, then submit again.",
      });
      return;
    }

    const saved = await submit.mutateAsync(submissionQuote);
    if (role === "external") {
      // External users get a dedicated confirmation page.
      void navigate({ to: "/request-quote/confirmation/$id", params: { id: saved.id } });
    } else {
      // Internal roles return to their own dashboard rather than being left
      // stranded on the now read-only quote they just submitted.
      void navigate({ to: homeRouteForRole(role) });
    }
  };

  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur">
      <div className="flex flex-col gap-1">
        <p className={marginError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {marginError
            ? marginError
            : readiness.ready
              ? "All required details are complete."
              : `${readiness.completedCount} of ${readiness.totalRequired} required details complete.`}
        </p>
        {editable ? <SaveStatus /> : null}
      </div>
      <div className="flex items-center gap-2">
        <DeleteDraftButton
          quote={quote}
          variant="button"
          onDeleted={() => void navigate({ to: homeRouteForRole(role) })}
        />
        {editable ? (

          <Button
            type="button"
            variant="outline"
            disabled={savingDraft}
            onClick={() => void handleSaveDraft()}
          >
            {savingDraft ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Save draft
          </Button>
        ) : null}
        {canSubmit ? (
          <Button
            type="button"
            disabled={!readiness.ready || Boolean(marginError) || submit.isPending}
            onClick={() => void handleSubmit()}
          >
            {submit.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isResubmit ? "Resubmit for review" : "Submit for Review"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

