import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntake } from "./IntakeContext";

interface ReturnNote {
  body: string;
  createdAt: string;
  authorLabel: string;
}

function useReturnNoteHistory(quoteId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["quote-comments", quoteId, "return-history"],
    enabled,
    queryFn: async (): Promise<ReturnNote[]> => {
      const { data, error } = await supabase
        .from("quote_comments")
        .select("*, author:profiles(id, email, full_name)")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const author = row["author"] as
          | { email?: string | null; full_name?: string | null }
          | null;
        return {
          body: String(row["body"]),
          createdAt: String(row["created_at"]),
          authorLabel: author?.full_name || author?.email || "Estimator",
        };
      });
    },
  });
}

/** Amber callout shown to the assigned rep when an estimator returned the quote. */
export function ReturnedNoteCallout() {
  const { quoteId, quote, role } = useIntake();
  // External requesters never see returns — from their side the quote is
  // simply still in review.
  const relevant =
    (quote.state === "estimator_adjusted" ||
      (quote.state === "draft" && Boolean(quote.submittedAt))) &&
    (role === "sales_rep" || role === "admin" || role === "estimator");
  const { data } = useReturnNoteHistory(quoteId, relevant);

  const notes = data ?? [];
  if (!relevant || notes.length === 0) return null;

  const [latest, ...earlier] = notes;
  if (!latest) return null;

  return (
    <Card className="border-amber-500/60 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-700 dark:text-amber-300">
          Returned by the estimator for revision
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Their notes:</p>
        <blockquote className="border-l-4 border-amber-500/70 bg-background/60 px-3 py-2 text-sm">
          {latest.body}
        </blockquote>
        <p className="text-xs text-muted-foreground">
          {latest.authorLabel} ·{" "}
          {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true })}
        </p>
        <p className="text-sm">
          Please review, update the quote, and resubmit when ready.
        </p>
        {earlier.length > 0 ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">
              Earlier returns ({earlier.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {earlier.map((note) => (
                <li key={note.createdAt} className="border-l-2 pl-3">
                  <p className="text-sm text-foreground">{note.body}</p>
                  <p>
                    {note.authorLabel} ·{" "}
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
