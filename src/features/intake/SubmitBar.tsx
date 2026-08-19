import { useFormContext } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  checkMarginJustification,
  readinessCheck,
  validateQuoteForSubmission,
  MARGIN_JUSTIFICATION_MESSAGE,
} from "@/lib/quote-validation";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "./IntakeContext";
import { useSubmitQuote } from "./useSubmitQuote";

/**
 * Sticky bottom action bar. Only requesters (external / sales rep) submit a
 * draft here; estimator approve/return actions live in the workflow bar.
 */
export function SubmitBar() {
  const { quote, quoteId, role, flushSave, updateField } = useIntake();
  const { user } = useAuth();
  const navigate = useNavigate();
  const form = useFormContext<QuoteFormData>();
  const submit = useSubmitQuote(quoteId, user?.id);

  const canSubmit = role === "external" || role === "sales_rep" || role === "admin";
  if (!canSubmit || quote.state !== "draft") return null;

  const readiness = readinessCheck(quote);
  const marginError = checkMarginJustification(quote);

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
      void navigate({ to: "/request-quote/confirmation/$id", params: { id: saved.id } });
    } else {
      void navigate({ to: "/quotes/$id", params: { id: saved.id } });
    }
  };

  return (
    <div className="sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur">
      <p className={marginError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {marginError
          ? marginError
          : readiness.ready
          ? "All required details are complete."
            : `${readiness.completedCount} of ${readiness.totalRequired} required details complete.`}
      </p>
      <Button
        type="button"
        disabled={!readiness.ready || Boolean(marginError) || submit.isPending}
        onClick={() => void handleSubmit()}
      >
        {submit.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        Submit for Review
      </Button>
    </div>
  );
}
