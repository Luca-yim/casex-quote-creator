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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAssignableOwners,
  ownerOptionLabel,
} from "@/hooks/useAssignableOwners";

export const RETURN_NOTE_MIN = 10;

/**
 * Collects the mandatory note plus the rep who owns the quote during rework.
 * Quotes are never returned to external requesters — an internal owner is
 * always required.
 */
export function ReturnQuoteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  currentOwnerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string, repId: string, repName: string) => void;
  isPending: boolean;
  currentOwnerId: string | null;
}) {
  const [note, setNote] = useState("");
  const [repId, setRepId] = useState<string>(currentOwnerId ?? "");
  const { data: owners = [], isLoading } = useAssignableOwners(open);

  useEffect(() => {
    setRepId(currentOwnerId ?? "");
  }, [currentOwnerId, open]);

  const tooShort = note.trim().length < RETURN_NOTE_MIN;
  const repName = owners.find((o) => o.id === repId)?.name ?? "";
  const disabled = tooShort || !repId || isPending;

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
          <DialogTitle>Return for edit</DialogTitle>
          <DialogDescription>
            The assigned rep sees this note at the top of the quote and reworks
            it before resubmitting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="return-rep">Assign to (required)</Label>
            <Select value={repId} onValueChange={setRepId} disabled={isLoading}>
              <SelectTrigger id="return-rep">
                <SelectValue placeholder="Select who should rework this quote..." />
              </SelectTrigger>
              <SelectContent>
                {owners.map((owner) => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {ownerOptionLabel(owner)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {currentOwnerId
                ? "Defaults to the current owner — change it to hand the rework to someone else."
                : "This quote came from an external requester — pick a rep to own the rework."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            disabled={disabled}
            onClick={() => onConfirm(note.trim(), repId, repName)}
          >
            {isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Return quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
