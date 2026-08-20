import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { Quote } from "@/types/quote";
import { canDeleteDraft, useDeleteQuote } from "./useDeleteQuote";

type Props = {
  quote: Quote;
  /** Icon-only button for dense list rows; labelled button elsewhere. */
  variant?: "icon" | "button";
  onDeleted?: () => void;
};

/** Renders nothing unless the signed-in user may delete this draft. */
export function DeleteDraftButton({ quote, variant = "icon", onDeleted }: Props) {
  const { user, role } = useAuth();
  const remove = useDeleteQuote();

  if (!canDeleteDraft(quote, user?.id, role)) return null;

  const label = quote.customerName || quote.name || "Untitled draft";

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={variant === "icon" ? "icon" : "sm"}
          aria-label={`Delete draft ${label}`}
          className="text-muted-foreground hover:text-destructive"
          onClick={(event) => event.stopPropagation()}
          disabled={remove.isPending}
        >
          {remove.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {variant === "button" ? <span className="ml-1">Delete draft</span> : null}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This draft has never been submitted for review, so deleting it is permanent and
            can&apos;t be undone. Quotes already in review are archived instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              remove.mutate(quote.id, { onSuccess: () => onDeleted?.() });
            }}
          >
            {remove.isPending ? "Deleting…" : "Delete draft"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
