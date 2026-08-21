import { Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProfileDirectory } from "@/hooks/useProfileNames";
import type { Quote } from "@/types/quote";

/**
 * Shown to estimators/admins while a returned quote sits with the sales rep.
 * The quote is read-only for them until the rep resubmits it for review.
 */
export function EstimatorRevisionBanner({ quote }: { quote: Quote }) {
  const directory = useProfileDirectory([quote.ownerId]);
  const repName = quote.ownerId
    ? (directory.data?.[quote.ownerId]?.name ?? "the assigned sales rep")
    : "the assigned sales rep";

  return (
    <Alert>
      <Lock className="size-4" />
      <AlertTitle>With {repName} for revision</AlertTitle>
      <AlertDescription>
        This quote is with {repName} for revision. You will be able to review it
        again once they resubmit. Version history remains available below.
      </AlertDescription>
    </Alert>
  );
}
