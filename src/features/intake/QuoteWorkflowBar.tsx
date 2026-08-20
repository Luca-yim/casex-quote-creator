import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useSalesReps } from "@/hooks/useSalesReps";
import {
  STATE_LABELS,
  availableActions,
  stageOwner,
  type WorkflowAction,
} from "@/lib/quote-workflow";
import { checkMarginJustification } from "@/lib/quote-validation";
import { useIntake } from "./IntakeContext";
import { useQuoteTransition } from "./useQuoteTransition";
import { ReturnQuoteDialog } from "./ReturnQuoteDialog";
import { VersionHistorySheet } from "./VersionHistorySheet";
import { QuotePdfDownloadButton } from "@/features/pdf-export/QuotePdfDownloadButton";
import { ExternalBadge } from "@/components/ExternalBadge";
import { useProfileDirectory } from "@/hooks/useProfileNames";

/** Transitions that persist pricing and therefore must satisfy the margin rule. */
const MARGIN_GATED_ACTIONS = new Set(["mark_adjusted", "approve", "submit_for_review"]);

/** Stage indicator plus the pipeline actions available to the current role. */
export function QuoteWorkflowBar() {
  const { quote, quoteId, role } = useIntake();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const transition = useQuoteTransition(quoteId, user?.id);
  const actions = availableActions(role, quote.state);
  const [returnOpen, setReturnOpen] = useState(false);

  // Estimator-side sales rep assignment (required for external-submitted quotes).
  const canAssign =
    (role === "estimator" || role === "admin") &&
    actions.some((a) => a.action === "approve");
  const { data: reps = [], isLoading: repsLoading } = useSalesReps(canAssign);
  const [assignedRepId, setAssignedRepId] = useState<string>(quote.ownerId ?? "");
  useEffect(() => {
    setAssignedRepId(quote.ownerId ?? "");
  }, [quote.ownerId]);

  const currentOwnerName = reps.find((r) => r.id === quote.ownerId)?.name ?? null;
  const assignedRepName = reps.find((r) => r.id === assignedRepId)?.name ?? null;
  const needsAssignment = canAssign && !quote.ownerId && !assignedRepId;

  // Requester identity + role, so external self-serve requests are obvious.
  const requesterProfiles = useProfileDirectory([quote.requestedBy]);
  const requester = quote.requestedBy
    ? requesterProfiles.data?.[quote.requestedBy]
    : undefined;
  const isExternalRequest = requester?.role === "external";

  const actorName = profile?.full_name || profile?.email || "a teammate";
  const returnAction = actions.find((a) => a.action === "return_to_sales");
  const marginError = checkMarginJustification(quote);
  const isBlocked = (action: WorkflowAction) =>
    (Boolean(marginError) && MARGIN_GATED_ACTIONS.has(action.action)) ||
    (action.action === "approve" && needsAssignment);

  const blockReason = (action: WorkflowAction) => {
    if (action.action === "approve" && needsAssignment)
      return "Assign a sales rep before approving";
    if (marginError && MARGIN_GATED_ACTIONS.has(action.action)) return marginError;
    return null;
  };

  const run = (
    action: WorkflowAction,
    note?: string,
    returnRep?: { id: string; name: string },
  ) => {
    if (isBlocked(action)) return;
    transition.mutate(
      {
        action,
        quote,
        actorName,
        actorRole: role,
        ...(note ? { note } : {}),
        ...(returnRep
          ? {
              assignRepId: returnRep.id,
              assignRepName: returnRep.name,
              previousRepName: currentOwnerName,
            }
          : {}),
        ...(action.action === "approve" && assignedRepId
          ? {
              assignRepId: assignedRepId,
              assignRepName: assignedRepName,
              previousRepName: currentOwnerName,
            }
          : {}),
      },
      {
        onSuccess: () => {
          if (action.action === "return_to_sales") {
            setReturnOpen(false);
            void navigate({ to: "/review" });
          }
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Pipeline status</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{STATE_LABELS[quote.state]}</Badge>
            <QuotePdfDownloadButton quote={quote} role={role} />
            <VersionHistorySheet quoteId={quoteId} />
          </div>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span>{stageOwner(quote.state)}</span>
          {requester ? (
            <span className="flex items-center gap-2">
              <span aria-hidden="true">·</span>
              <span>Requested by {requester.name}</span>
              {isExternalRequest ? <ExternalBadge variant="full" /> : null}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      {actions.length > 0 ? (
        <CardContent className="space-y-3">
          {canAssign ? (
            <div className="space-y-1.5 rounded-md border p-3">
              <Label htmlFor="assign-rep">Assign to sales rep</Label>
              <Select
                value={assignedRepId}
                onValueChange={setAssignedRepId}
                disabled={repsLoading}
              >
                <SelectTrigger id="assign-rep" className="w-full sm:w-80">
                  <SelectValue placeholder="Select a rep..." />
                </SelectTrigger>
                <SelectContent>
                  {reps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {quote.ownerId
                  ? `Currently owned by ${currentOwnerName ?? "a sales rep"} — reassign if needed`
                  : "Submitted by an external requester — assign a rep before approving."}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.action}
                variant={action.variant}
                disabled={transition.isPending || isBlocked(action)}
                title={blockReason(action) ?? action.description}
                aria-describedby={
                  isBlocked(action) ? "margin-justification-error" : undefined
                }
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
          </div>
          {marginError && actions.some(isBlocked) ? (
            <p
              id="margin-justification-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {marginError}
            </p>
          ) : null}
        </CardContent>
      ) : null}

      {returnAction ? (
        <ReturnQuoteDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          isPending={transition.isPending}
          currentOwnerId={quote.ownerId ?? null}
          onConfirm={(note, repId, repName) =>
            run(returnAction, note, { id: repId, name: repName })
          }
        />
      ) : null}
    </Card>
  );
}
