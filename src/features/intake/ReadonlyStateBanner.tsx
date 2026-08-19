import { Eye } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { STATE_LABELS } from "@/lib/quote-workflow";
import type { Quote } from "@/types/quote";

function formatDate(iso: string | null): string {
  if (!iso) return "an earlier date";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** State-specific explanation of why this quote is view-only. */
export function readonlyMessage(quote: Quote): string {
  switch (quote.state) {
    case "submitted_for_review":
      return "Waiting for estimator review.";
    case "under_review":
      return "Estimator is reviewing your pricing.";
    case "approved":
      return `Approved on ${formatDate(quote.approvedAt)}. Ready to send.`;
    case "sent_to_customer":
      return `Sent to customer ${quote.customerName ?? ""} on ${formatDate(
        quote.sentAt,
      )}.`.replace("  ", " ");
    case "accepted":
      return `Customer accepted this quote on ${formatDate(quote.updatedAt)}.`;
    case "declined":
      return `Customer declined this quote on ${formatDate(quote.updatedAt)}.`;
    case "archived":
      return "This quote has been archived.";
    default:
      return "You do not have edit rights at this stage.";
  }
}

/** Banner shown at the top of the intake when the quote cannot be edited. */
export function ReadonlyStateBanner({ quote }: { quote: Quote }) {
  return (
    <Alert>
      <Eye className="size-4" />
      <AlertTitle>
        This quote is {STATE_LABELS[quote.state].toLowerCase()} — view only
      </AlertTitle>
      <AlertDescription>{readonlyMessage(quote)}</AlertDescription>
    </Alert>
  );
}
