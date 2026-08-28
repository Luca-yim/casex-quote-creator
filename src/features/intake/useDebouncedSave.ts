import { useCallback, useEffect, useRef, useState } from "react";
import { quoteDetailKey } from "./useQuote";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { QUOTE_FIELD_COLUMNS } from "./quote-mapper";
import type { Quote } from "@/types/quote";
import { describeQuoteWriteError } from "@/lib/supabase-errors";

/** Debounce window, in ms, between the last change and the save request. */
export const AUTOSAVE_DEBOUNCE_MS = 500;

/**
 * Merges a camelCase field path/value pair into a pending patch keyed by the
 * matching database column. Later writes to the same field win, so several
 * rapid edits collapse into one column value.
 */
export function mergePendingPatch(
  pending: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const column = QUOTE_FIELD_COLUMNS[path];
  if (!column) return pending;
  return { ...pending, [column]: value };
}

export interface DebouncedSave {
  /** Queue a single field change; saves are batched and debounced. */
  save: (path: string, value: unknown) => void;
  /** Flush any queued changes immediately (e.g. before submitting). */
  flush: () => Promise<void>;
  isSaving: boolean;
  lastSavedAt: Date | null;
  /** True while edits are queued but not yet written to the database. */
  hasPendingChanges: boolean;
}

interface SaveInput {
  /** Column-keyed patch sent to PostgREST. */
  patch: Record<string, unknown>;
  /** The same values in domain (camelCase) shape, for the cache update. */
  fields: Partial<Quote>;
}

/**
 * Debounced, batched auto-save for a quote draft. Invalid drafts still save —
 * validation only gates submission.
 */
export function useDebouncedSave(quoteId: string): DebouncedSave {
  const queryClient = useQueryClient();
  const pendingRef = useRef<Record<string, unknown>>({});
  const pendingFieldsRef = useRef<Partial<Quote>>({});
  const timerRef = useRef<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);


  const mutation = useMutation({
    mutationFn: async ({ patch, fields }: SaveInput): Promise<Partial<Quote>> => {
      // No `.select()` echo: SELECT on `public.quotes` is revoked so pricing
      // columns can only leave the database through `quotes_scoped()`. The
      // cache is updated from the patch we just sent.
      const { error } = await supabase
        .from("quotes")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(patch as any)
        .eq("id", quoteId);
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
      return fields;
    },
    onSuccess: (fields) => {
      queryClient.setQueriesData<Quote>(
        { queryKey: quoteDetailKey(quoteId) },
        (previous) =>
          previous
            ? { ...previous, ...fields, updatedAt: new Date().toISOString() }
            : previous,
      );
      setLastSavedAt(new Date());
    },
    onError: (error) => {
      toast.error("Could not save your changes", {
        description: describeQuoteWriteError(error),
      });
    },
  });


  const { mutateAsync } = mutation;

  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return;
    try {
      await mutateAsync(patch);
      setHasPendingChanges(false);
    } catch {
      // Handled by onError. The queue was already drained, so the failed patch
      // is not retried — the user's next edit re-queues from current state.
      setHasPendingChanges(false);
    }
  }, [mutateAsync]);

  const save = useCallback(
    (path: string, value: unknown) => {
      const next = mergePendingPatch(pendingRef.current, path, value);
      if (next === pendingRef.current) return;
      pendingRef.current = next;
      setHasPendingChanges(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return {
    save,
    flush,
    isSaving: mutation.isPending,
    lastSavedAt,
    hasPendingChanges,
  };

}
