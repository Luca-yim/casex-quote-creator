import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  type WorkflowAction,
} from "@/lib/quote-workflow";
import { useIntake } from "./IntakeContext";
import { useQuoteTransition } from "./useQuoteTransition";
import { ReturnQuoteDialog } from "./ReturnQuoteDialog";
import { VersionHistorySheet } from "./VersionHistorySheet";

/** Stage indicator plus the pipeline actions available to the current role. */
export function QuoteWorkflowBar() {
  const { quote, quoteId, role } = useIntake();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const transition = useQuoteTransition(quoteId, user?.id);
  const actions = availableActions(role, quote.state);
  const [returnOpen, setReturnOpen] = useState(false);

  const actorName = profile?.full_name || profile?.email || "a teammate";
  const returnAction = actions.find((a) => a.action === "return_to_sales");

  const run = (action: WorkflowAction, note?: string) =>
    transition.mutate(
      { action, quote, actorName, actorRole: role, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          if (action.action === "return_to_sales") {
            setReturnOpen(false);
            void navigate({ to: "/review" });
          }
        },
      },
    );

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Pipeline status</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{STATE_LABELS[quote.state]}</Badge>
            <VersionHistorySheet quoteId={quoteId} />
          </div>
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
              onClick={() =>
                action.action === "return_to_sales"
                  ? setReturnOpen(true)
                  : run(action)
              }
            >
              {transition.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {action.label}
            </Button>
          ))}
        </CardContent>
      ) : null}

      {returnAction ? (
        <ReturnQuoteDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          isPending={transition.isPending}
          onConfirm={(note) => run(returnAction, note)}
        />
      ) : null}
    </Card>
  );
}
