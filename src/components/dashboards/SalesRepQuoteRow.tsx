import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQuoteTransition } from "@/features/intake/useQuoteTransition";
import { availableActions, STATE_LABELS } from "@/lib/quote-workflow";
import type { Quote } from "@/types/quote";
import { DeleteDraftButton } from "@/features/quotes/DeleteDraftButton";

function relativeDays(iso: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return `${days}d ago`;
}

export function SalesRepQuoteRow({ quote }: { quote: Quote }) {
  const { role, user, profile } = useAuth();
  const navigate = useNavigate();
  const actorName = profile?.full_name || profile?.email || "a sales rep";
  const transition = useQuoteTransition(quote.id, user?.id);

  const actions = role ? availableActions(role, quote.state) : [];
  const sendAction = actions.find((a) => a.action === "send_to_customer");

  const open = () => {
    void navigate({ to: "/quotes/$id", params: { id: quote.id } });
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
          {" · updated "}
          {relativeDays(quote.updatedAt)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{STATE_LABELS[quote.state]}</Badge>
        {sendAction ? (
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              transition.mutate({
                action: sendAction,
                quote,
                actorName,
                actorRole: role,
              });
            }}
            disabled={transition.isPending}
          >
            <Send className="mr-1 size-4" />
            {transition.isPending ? "Sending…" : "Send to Customer"}
          </Button>
        ) : null}
        <DeleteDraftButton quote={quote} />
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </li>
  );
}
