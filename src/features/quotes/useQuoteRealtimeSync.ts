import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "@/features/intake/quote-mapper";
import { STATE_LABELS } from "@/lib/quote-workflow";
import { REVIEW_QUEUE_STATES } from "@/features/review/useReviewQueue";
import type { Quote } from "@/types/quote";

type Scope =
  | { kind: "sales_rep"; userId: string | undefined }
  | { kind: "estimator" };

interface Options {
  /** Which rows this dashboard cares about. */
  scope: Scope;
  /** Query cache key holding the `Quote[]` list this dashboard renders. */
  queryKey: QueryKey;
}

/** True when the row belongs in this dashboard's list. */
function inScope(quote: Quote, scope: Scope): boolean {
  if (scope.kind === "estimator") {
    return (REVIEW_QUEUE_STATES as readonly string[]).includes(quote.state);
  }
  if (!scope.userId) return false;
  return quote.requestedBy === scope.userId || quote.ownerId === scope.userId;
}

/** Fetches the newest audit note so a "returned" toast can explain why. */
async function latestChangeReason(quoteId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("change_reason")
    .eq("quote_id", quoteId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return ((data as { change_reason?: string | null } | null)?.change_reason) ?? null;
}

function mergeIntoList(list: Quote[] | undefined, quote: Quote, keep: boolean): Quote[] {
  const current = list ?? [];
  const without = current.filter((q) => q.id !== quote.id);
  if (!keep) return without;
  return [quote, ...without];
}

/**
 * Live-syncs a dashboard's quote list with `public.quotes` changes.
 *
 * Purely additive: it merges realtime rows into the existing query cache and
 * raises a toast on state transitions. No transition logic is performed here.
 */
export function useQuoteRealtimeSync({ scope, queryKey }: Options) {
  const queryClient = useQueryClient();
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;

  const channelName = scope.kind === "estimator" ? "quotes-review-queue" : `quotes-rep-${scope.userId ?? "anon"}`;
  const enabled = scope.kind === "estimator" || Boolean(scope.userId);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes" },
        (payload) => {
          const activeScope = scopeRef.current;
          const key = keyRef.current;

          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string } | null)?.id;
            if (!oldId) return;
            queryClient.setQueryData<Quote[]>(key, (list) =>
              (list ?? []).filter((q) => q.id !== oldId),
            );
            return;
          }

          const newRow = payload.new as Record<string, unknown> | null;
          if (!newRow || !newRow["id"]) return;

          let quote: Quote;
          try {
            quote = rowToQuote(newRow as never);
          } catch {
            queryClient.invalidateQueries({ queryKey: key });
            return;
          }

          // REPLICA IDENTITY FULL gives us the previous row on UPDATE.
          const previousState =
            payload.eventType === "UPDATE"
              ? ((payload.old as Record<string, unknown> | null)?.["state"] as string | undefined)
              : undefined;

          const relevant = inScope(quote, activeScope);
          const wasListed = ((queryClient.getQueryData<Quote[]>(key) ?? []).some(
            (q) => q.id === quote.id,
          ));

          if (!relevant && !wasListed) return;

          queryClient.setQueryData<Quote[]>(key, (list) => mergeIntoList(list, quote, relevant));

          const stateChanged = previousState !== undefined && previousState !== quote.state;
          if (!stateChanged && !(payload.eventType === "INSERT" && relevant)) return;

          const label = quote.customerName || quote.name || "A quote";

          if (activeScope.kind === "estimator") {
            if (quote.state === "submitted_for_review") {
              toast.info("New quote in your review queue", { description: `${label} was submitted for review.` });
            } else if (relevant) {
              toast.info("Review queue updated", { description: `${label} → ${STATE_LABELS[quote.state]}.` });
            } else {
              toast.info("Quote left the review queue", { description: `${label} → ${STATE_LABELS[quote.state]}.` });
            }
            return;
          }

          // Sales rep view.
          if (quote.state === "approved") {
            toast.success("Quote approved", { description: `${label} is approved and ready to send.` });
          } else if (quote.state === "draft" && previousState && previousState !== "draft") {
            void latestChangeReason(quote.id).then((reason) => {
              toast.warning("Quote returned for more info", {
                description: reason ? `${label}: ${reason}` : `${label} was returned by the estimator.`,
              });
            });
          } else if (stateChanged) {
            toast.info("Quote updated", { description: `${label} → ${STATE_LABELS[quote.state]}.` });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, enabled, queryClient]);
}
