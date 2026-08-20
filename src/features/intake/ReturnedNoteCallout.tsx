import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useIntake } from "./IntakeContext";
import { useQuoteVersions } from "./useQuoteVersions";
import { VersionHistorySheet } from "./VersionHistorySheet";

export const RETURN_REASON_PREFIX = "Returned for edit:";

/** Strips the audit-trail prefix so only the estimator's note is shown. */
export function returnNoteFromReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (!reason.startsWith(RETURN_REASON_PREFIX)) return null;
  const note = reason.slice(RETURN_REASON_PREFIX.length).trim();
  return note.length > 0 ? note : null;
}

/**
 * Amber banner shown to the assigned rep when an estimator returned the quote.
 *
 * Sourced from `quote_versions`: the newest snapshot whose `change_type` is
 * `return` (or whose `change_reason` carries the "Returned for edit:" prefix).
 * Only rendered while the quote sits in `estimator_adjusted` and the viewer
 * owns it, so it disappears as soon as the rep resubmits.
 */
export function ReturnedNoteCallout() {
  const { quoteId, quote, role } = useIntake();
  const { user } = useAuth();

  const isOwner = Boolean(user?.id && quote.ownerId === user.id);
  // External requesters never see returns — from their side the quote is
  // simply still in review. Estimators/admins keep visibility for context.
  const relevant =
    quote.state === "estimator_adjusted" &&
    (isOwner || role === "estimator" || role === "admin");

  const { data } = useQuoteVersions(quoteId, relevant);

  if (!relevant) return null;

  const latest = (data ?? []).find(
    (entry) =>
      entry.changeType === "return" || returnNoteFromReason(entry.changeReason) !== null,
  );
  const note = latest ? returnNoteFromReason(latest.changeReason) : null;
  if (!latest || !note) return null;

  return (
    <Card className="border-amber-500/60 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Quote returned by estimator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Returned by {latest.authorLabel} ·{" "}
          {formatDistanceToNow(new Date(latest.changedAt), { addSuffix: true })}
        </p>
        <blockquote className="border-l-4 border-amber-500/70 bg-background/60 px-3 py-2 text-sm">
          {note}
        </blockquote>
        <p className="text-sm">
          Please review, update the quote, and resubmit when ready.
        </p>
        <VersionHistorySheet quoteId={quoteId} />
      </CardContent>
    </Card>
  );
}
