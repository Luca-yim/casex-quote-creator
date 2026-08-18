import { Link } from "@tanstack/react-router";
import { ArrowRight, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQuoteTransition } from "@/features/intake/useQuoteTransition";
import { availableActions, STATE_LABELS } from "@/lib/quote-workflow";
import type { Quote } from "@/types/quote";

function relativeDays(iso: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return `${days}d ago`;
}

export function SalesRepQuoteRow({ quote }: { quote: Quote }) {
  const { role, user } = useAuth();
  const transition = useQuoteTransition(quote.id, user?.id);

  const actions = role ? availableActions(role, quote.state) : [];
  const sendAction = actions.find((a) => a.action === "send_to_customer");

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-4">
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
            onClick={() => transition.mutate(sendAction)}
            disabled={transition.isPending}
          >
            <Send className="mr-1 size-4" />
            {transition.isPending ? "Sending…" : "Send to Customer"}
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link to="/quotes/$id" params={{ id: quote.id }}>
              Open <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}
