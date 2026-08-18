import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import {
  STATE_LABELS,
  availableActions,
  stageOwner,
} from "@/lib/quote-workflow";
import { useIntake } from "./IntakeContext";
import { useQuoteTransition } from "./useQuoteTransition";

/** Stage indicator plus the pipeline actions available to the current role. */
export function QuoteWorkflowBar() {
  const { quote, quoteId, role } = useIntake();
  const { user } = useAuth();
  const transition = useQuoteTransition(quoteId, user?.id);
  const actions = availableActions(role, quote.state);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Pipeline status</CardTitle>
          <Badge variant="secondary">{STATE_LABELS[quote.state]}</Badge>
        </div>
        <CardDescription>{stageOwner(quote.state)}</CardDescription>
      </CardHeader>
      {actions.length > 0 ? (
        <CardContent className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.action}
              variant={action.variant}
              disabled={transition.isPending}
              title={action.description}
              onClick={() => transition.mutate(action)}
            >
              {transition.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {action.label}
            </Button>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
