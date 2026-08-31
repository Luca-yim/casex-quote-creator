import { useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { canPromoteToProposal } from "@/lib/quote-workflow";
import { useIntake } from "@/features/intake/IntakeContext";
import { usePromoteToProposal } from "./usePromoteToProposal";

/**
 * One-way "Convert to proposal" action. Visible only to estimator/admin while
 * the quote is `under_review` and still at `ballpark` fidelity. Confirmation
 * is required because there is no demotion path.
 */
export function PromoteToProposalButton() {
  const { quote, quoteId, role } = useIntake();
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const promote = usePromoteToProposal(quoteId, user?.id);

  if (!canPromoteToProposal(role, quote.state, quote.tier)) return null;

  const actorName = profile?.full_name || profile?.email || "a teammate";

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={promote.isPending}>
        {promote.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowUpRight className="size-4" aria-hidden="true" />
        )}
        Convert to proposal
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert to proposal?</AlertDialogTitle>
            <AlertDialogDescription>
              This raises the quote from a ballpark estimate to a full proposal and
              opens the WBS cost-basis editor. It cannot be undone — there is no way
              to return this quote to ballpark fidelity.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                promote.mutate({ quote, actorName });
                setOpen(false);
              }}
            >
              Convert to proposal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
