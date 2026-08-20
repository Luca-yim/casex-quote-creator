import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const RETURN_NOTE_MIN = 10;

export const NO_REP_TOOLTIP =
  "Select a rep in the assignment dropdown before returning this quote.";

/**
 * Collects the mandatory return note. Ownership of the rework comes from the
 * "Assign to sales rep" dropdown on the quote detail page, so the modal only
 * reports whether a rep has been chosen.
 */
export function ReturnQuoteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  assignedRepId,
  assignedRepName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => void;
  isPending: boolean;
  assignedRepId: string | null;
  assignedRepName: string | null;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const tooShort = note.trim().length < RETURN_NOTE_MIN;
  const hasRep = Boolean(assignedRepId);
  const disabled = tooShort || !hasRep || isPending;

  const confirmButton = (
    <Button disabled={disabled} onClick={() => onConfirm(note.trim())}>
      {isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
      Return quote
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return for edit</DialogTitle>
          <DialogDescription>
            {hasRep
              ? `${assignedRepName ?? "The assigned rep"} sees this note at the top of the quote and reworks it before resubmitting.`
              : "Pick an owner in the “Assign to sales rep” dropdown — quotes are never returned to external requesters."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="return-note">What needs clarification? (required)</Label>
          <Textarea
            id="return-note"
            rows={5}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g., Please confirm case worker count includes supervisors, or split them into a separate line item."
          />
          <p className="text-xs text-muted-foreground">
            {note.trim().length}/{RETURN_NOTE_MIN} characters minimum
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          {hasRep ? (
            confirmButton
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>{confirmButton}</span>
                </TooltipTrigger>
                <TooltipContent>{NO_REP_TOOLTIP}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
