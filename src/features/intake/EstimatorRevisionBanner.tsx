import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProfileNames } from "@/hooks/useProfileNames";

/**
 * Neutral info banner shown to estimators when a quote has been returned to a
 * sales rep for revision. The estimator cannot act until the rep resubmits.
 */
export function EstimatorRevisionBanner({ ownerId }: { ownerId: string | null }) {
  const { data } = useProfileNames([ownerId]);
  const repName = (ownerId ? data?.[ownerId] : null) || "the rep";

  return (
    <Alert>
      <Info className="size-4" />
      <AlertTitle>Waiting on the sales rep</AlertTitle>
      <AlertDescription>
        This quote is with {repName} for revision. You will be able to review it
        again once they resubmit.
      </AlertDescription>
    </Alert>
  );
}
