import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

export const RETURN_REASON_PREFIX = "Returned for edit:";

/** Strips the audit-trail prefix so only the estimator's note is shown. */
export function returnNoteFromReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (!reason.startsWith(RETURN_REASON_PREFIX)) return null;
  const note = reason.slice(RETURN_REASON_PREFIX.length).trim();
  return note.length > 0 ? note : null;
}

export interface ReturnNoteData {
  note: string;
  changedAt: string;
  authorLabel: string;
}

/**
 * Fetches the newest "returned for edit" snapshot for a quote.
 *
 * Deliberately avoids an embedded `profiles(...)` join: reps can only select
 * their own profile row, so the join silently yields null for them. The author
 * name is resolved with a second, best-effort lookup instead.
 */
async function fetchReturnNote(quoteId: string): Promise<ReturnNoteData | null> {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("change_reason, changed_at, changed_by")
    .eq("quote_id", quoteId)
    .like("change_reason", `${RETURN_REASON_PREFIX}%`)
    .order("version_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);

  const row = (data ?? [])[0] as
    | { change_reason: string | null; changed_at: string; changed_by: string | null }
    | undefined;
  if (!row) return null;
  const note = returnNoteFromReason(row.change_reason);
  if (!note) return null;

  let authorLabel = "the estimator";
  if (row.changed_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", row.changed_by)
      .maybeSingle();
    const p = profile as { full_name?: string | null; email?: string | null } | null;
    authorLabel = p?.full_name || p?.email || authorLabel;
  }

  return { note, changedAt: row.changed_at, authorLabel };
}

export interface ReturnNoteBannerProps {
  quoteId: string;
  quoteState: string;
  quoteOwnerId?: string | null;
  /** Optional slot rendered under the note (e.g. version history link). */
  children?: React.ReactNode;
}

/**
 * Amber banner shown while a quote sits in `estimator_adjusted`, surfacing the
 * estimator's return note to whoever opens the quote detail view (rep,
 * estimator or admin). Renders nothing in any other state.
 */
export function ReturnNoteBanner({ quoteId, quoteState, children }: ReturnNoteBannerProps) {
  const enabled = Boolean(quoteId) && quoteState === "estimator_adjusted";
  const { data } = useQuery({
    queryKey: ["quote-return-note", quoteId],
    enabled,
    queryFn: () => fetchReturnNote(quoteId),
  });

  if (!enabled || !data) return null;

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
          Returned by {data.authorLabel} ·{" "}
          {formatDistanceToNow(new Date(data.changedAt), { addSuffix: true })}
        </p>
        <blockquote className="border-l-4 border-amber-500/70 bg-background/60 px-3 py-2 text-sm">
          {data.note}
        </blockquote>
        <p className="text-sm">Please review, update the quote, and resubmit when ready.</p>
        {children}
      </CardContent>
    </Card>
  );
}
