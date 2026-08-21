import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "@/features/intake/quote-mapper";
import { STATE_LABELS } from "@/lib/quote-workflow";
import { REVIEW_QUEUE_STATES } from "@/features/review/useReviewQueue";
import { HISTORY_STATES } from "@/features/review/useQuoteHistory";
import type { Quote } from "@/types/quote";

type Scope =
  | { kind: "sales_rep"; userId: string | undefined }
  | { kind: "estimator"; userId: string | undefined }
  | { kind: "admin" };

interface Options {
  /** Which rows this dashboard cares about. */
  scope: Scope;
  /**
   * Query cache key holding the `Quote[]` list this dashboard renders and
   * merges realtime rows into. Omit for invalidate-only scopes (admin).
   */
  queryKey?: QueryKey;
}

/** True when the row belongs in this dashboard's merged list. */
function inScope(quote: Quote, scope: Scope): boolean {
  if (scope.kind === "admin") return false;
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

/** Keys the estimator dashboard renders outside its merged review queue. */
const DRAFTS_KEY = (userId: string | undefined) => ["quotes", "my-drafts", userId] as const;
const HISTORY_KEY = ["quotes", "estimator-history"] as const;

/** Pipeline caches are aggregated server-side, so they can only be refetched. */
const PIPELINE_KEYS = [["pipeline"], ["pipeline-stats"]] as const;

/**
 * Live-syncs a dashboard's quote list with `public.quotes` changes.
 *
 * Purely additive: it merges realtime rows into the existing query cache
 * (when a `queryKey` is given), invalidates sibling caches that can't be
 * merged, and raises a toast on state transitions. No transition logic here.
 */
export function useQuoteRealtimeSync({ scope, queryKey }: Options) {
  const queryClient = useQueryClient();
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;

  const scopeUserId = scope.kind === "admin" ? undefined : scope.userId;
  const channelName =
    scope.kind === "estimator"
      ? "quotes-review-queue"
      : scope.kind === "admin"
        ? "quotes-pipeline"
        : `quotes-rep-${scopeUserId ?? "anon"}`;
  const enabled = scope.kind !== "sales_rep" || Boolean(scopeUserId);

  useEffect(() => {
    if (!enabled) return;

    /** Refetch the caches this scope can't merge into. */
    const invalidateSiblings = (
      activeScope: Scope,
      states: (string | undefined)[],
    ) => {
      if (activeScope.kind === "admin") {
        for (const key of PIPELINE_KEYS) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
        return;
      }
      if (activeScope.kind !== "estimator") return;

      if (states.includes("draft")) {
        void queryClient.invalidateQueries({ queryKey: DRAFTS_KEY(activeScope.userId) });
      }
      if (states.some((s) => s && (HISTORY_STATES as readonly string[]).includes(s))) {
        void queryClient.invalidateQueries({ queryKey: HISTORY_KEY });
      }
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes" },
        (payload) => {
          const activeScope = scopeRef.current;
          const key = keyRef.current;
          const oldState = (payload.old as Record<string, unknown> | null)?.["state"] as
            | string
            | undefined;
          const newState = (payload.new as Record<string, unknown> | null)?.["state"] as
            | string
            | undefined;

          invalidateSiblings(activeScope, [oldState, newState]);

          if (payload.eventType === "DELETE") {
            const oldId = (payload.old as { id?: string } | null)?.id;
            if (!oldId || !key) return;
            queryClient.setQueryData<Quote[]>(key, (list) =>
              (list ?? []).filter((q) => q.id !== oldId),
            );
            return;
          }

          const newRow = payload.new as Record<string, unknown> | null;
          if (!newRow || !newRow["id"] || !key) return;

          let quote: Quote;
          try {
            quote = rowToQuote(newRow as never);
          } catch {
            void queryClient.invalidateQueries({ queryKey: key });
            return;
          }

          // REPLICA IDENTITY FULL gives us the previous row on UPDATE.
          const previousState = payload.eventType === "UPDATE" ? oldState : undefined;

          const relevant = inScope(quote, activeScope);
          const wasListed = (queryClient.getQueryData<Quote[]>(key) ?? []).some(
            (q) => q.id === quote.id,
          );

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
