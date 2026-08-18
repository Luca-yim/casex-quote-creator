import { useState } from "react";
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

export const RETURN_NOTE_MIN = 20;

/** Collects the mandatory explanation before a quote goes back to the requester. */
export function ReturnQuoteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => void;
  isPending: boolean;
}) {
  const [note, setNote] = useState("");
  const tooShort = note.trim().length < RETURN_NOTE_MIN;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setNote("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return for more info</DialogTitle>
          <DialogDescription>
            The requester sees this note at the top of their intake form.
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
          <Button
            disabled={tooShort || isPending}
            onClick={() => onConfirm(note.trim())}
          >
            {isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Return quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
