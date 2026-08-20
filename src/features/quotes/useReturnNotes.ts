import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ReturnNote {
  quoteId: string;
  body: string;
  createdAt: string;
}

/**
 * Latest estimator return note per quote, for the "Attention needed" rows on
 * the rep dashboard. One query for the whole list — never per row.
 */
export function useReturnNotes(quoteIds: string[]) {
  const unique = Array.from(new Set(quoteIds)).sort();

  return useQuery({
    queryKey: ["quote-comments", "return-notes", unique.join(",")],
    enabled: unique.length > 0,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Record<string, ReturnNote>> => {
      const { data, error } = await supabase
        .from("quote_comments")
        .select("quote_id, body, created_at")
        .in("quote_id", unique)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const latest: Record<string, ReturnNote> = {};
      for (const row of (data ?? []) as Array<Record<string, string>>) {
        const quoteId = String(row["quote_id"]);
        if (latest[quoteId]) continue;
        latest[quoteId] = {
          quoteId,
          body: String(row["body"]),
          createdAt: String(row["created_at"]),
        };
      }
      return latest;
    },
  });
}
