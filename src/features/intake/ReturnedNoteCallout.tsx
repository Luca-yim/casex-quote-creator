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

function useLatestReturnNote(quoteId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["quote-comments", quoteId, "latest-return"],
    enabled,
    queryFn: async (): Promise<ReturnNote | null> => {
      const { data, error } = await supabase
        .from("quote_comments")
        .select("*, author:profiles(id, email, full_name)")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      const row = (data ?? [])[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      const author = row["author"] as { email?: string | null; full_name?: string | null } | null;
      return {
        body: String(row["body"]),
        createdAt: String(row["created_at"]),
        authorLabel: author?.full_name || author?.email || "Estimator",
      };
    },
  });
}

/** Amber callout shown to the requester when an estimator sent the quote back. */
export function ReturnedNoteCallout() {
  const { quoteId, quote, role } = useIntake();
  const relevant =
    quote.state === "draft" &&
    Boolean(quote.submittedAt) &&
    (role === "sales_rep" || role === "external" || role === "admin");
  const { data } = useLatestReturnNote(quoteId, relevant);

  if (!relevant || !data) return null;

  return (
    <Card className="border-amber-500/60 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-700 dark:text-amber-300">
          🔄 Returned by estimator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">{data.body}</p>
        <p className="text-xs text-muted-foreground">
          {data.authorLabel} ·{" "}
          {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
