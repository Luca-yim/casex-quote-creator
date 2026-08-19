import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATE_LABELS } from "@/lib/quote-workflow";
import type { Quote } from "@/types/quote";

function relativeDays(iso: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return `${days}d ago`;
}

/** Clickable estimator row; opens the review detail view for any state. */
export function EstimatorQuoteRow({ quote }: { quote: Quote }) {
  const navigate = useNavigate();
  const open = () => {
    void navigate({ to: "/review/$id", params: { id: quote.id } });
  };

  return (
    <li
      role="link"
      tabIndex={0}
      aria-label={`Open quote ${quote.customerName || quote.name || "Untitled quote"}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {quote.customerName || quote.name || "Untitled quote"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[quote.vertical, quote.solution].filter(Boolean).join(" · ") ||
            "No vertical selected"}
          {" · submitted "}
          {relativeDays(quote.submittedAt)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{STATE_LABELS[quote.state]}</Badge>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </li>
  );
}
