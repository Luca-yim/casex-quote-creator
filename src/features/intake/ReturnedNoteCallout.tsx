import { ReturnNoteBanner } from "@/components/ReturnNoteBanner";
import { useIntake } from "./IntakeContext";
import { VersionHistorySheet } from "./VersionHistorySheet";

export { RETURN_REASON_PREFIX, returnNoteFromReason } from "@/components/ReturnNoteBanner";

/**
 * Intake-page wrapper around the shared {@link ReturnNoteBanner}.
 *
 * External requesters never see returns — from their side the quote is simply
 * still in review — so the banner is skipped for that role. Reps, estimators
 * and admins all land on the same IntakePage, so mounting here covers both the
 * rep edit view (/quotes/$id) and the estimator review view (/review/$id).
 */
export function ReturnedNoteCallout() {
  const { quoteId, quote, role } = useIntake();

  if (role === "external") return null;

  return (
    <ReturnNoteBanner quoteId={quoteId} quoteState={quote.state} quoteOwnerId={quote.ownerId}>
      <VersionHistorySheet quoteId={quoteId} />
    </ReturnNoteBanner>
  );
}
