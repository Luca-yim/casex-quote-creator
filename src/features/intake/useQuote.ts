import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "./quote-mapper";
import type { Quote } from "@/types/quote";
import type { AppRole } from "@/lib/auth";
import { devLog } from "@/lib/debug-log";
import { useAuth } from "@/lib/auth";
import { quoteSelectForRole } from "@/lib/quote-columns";

/**
 * Cache key prefix for a single quote's detail entry.
 *
 * The read key carries a trailing role segment (the projection differs per
 * role), so every writer must target this PREFIX rather than an exact key —
 * otherwise cache writes silently land on an entry nobody reads.
 */
export function quoteDetailKey(quoteId: string | undefined) {
  return ["quote", quoteId] as const;
}

/**
 * Fetches a single quote by id and maps it to the domain shape.
 *
 * The query stays disabled until the signed-in role is known: the column
 * projection is role-dependent, so firing early would issue a wrong-projection
 * request and then a second one once the role resolves.
 */
export function useQuoteById(quoteId: string | undefined) {
  const { role, loading, profileLoading } = useAuth();
  const roleResolved = !loading && !profileLoading && role !== null;
  return useQuery({
    queryKey: [...quoteDetailKey(quoteId), role],
    enabled: Boolean(quoteId) && roleResolved,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<Quote> => {
      // NOTE: `quotes_scoped()` is SECURITY DEFINER and therefore bypasses RLS.
      // Any future change to the RLS policies on `public.quotes` must be
      // mirrored in the function's WHERE clause in Supabase — the function does
      // not inherit policy changes automatically.
      const { data, error } = await supabase
        .rpc("quotes_scoped")
        .select(quoteSelectForRole(role))
        .eq("id", quoteId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Quote not found");
      return rowToQuote(data as never);
    },

  });
}


type CreateDraftOptions = {
  userId: string | undefined;
  role: AppRole | null;
  onSuccess: (quote: Quote) => void;
};

/** Creates a new draft quote after auth and profile hydration have completed. */
export function useCreateDraftQuote({ userId, role, onSuccess }: CreateDraftOptions) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["quote-create", userId],
    mutationFn: async (): Promise<Quote> => {
      if (!userId) throw new Error("Not signed in");
      const CREATORS: AppRole[] = ["sales_rep", "estimator", "admin", "external"];
      if (!role || !CREATORS.includes(role)) {
        throw new Error("Your role cannot create quotes from this page.");
      }

      // The id is generated client-side so the insert never needs a
      // `.select()` echo: SELECT on `public.quotes` is revoked so pricing
      // columns can only leave the database through `quotes_scoped()`.
      const now = new Date().toISOString();
      const insertPayload = {
        id: crypto.randomUUID(),
        requested_by: userId,
        // External requests have no owner until an estimator assigns one.
        owner_id: role === "external" ? null : userId,
        tier: "ballpark" as const,
        state: "draft" as const,
        // Drafts start unnamed; the input shows "Untitled Quote" as a
        // placeholder and persistence auto-names on submit.
        name: "",
        margin_percent: 20,
        contract_years: 3,
      };

      devLog("[quote-create] insert payload:", insertPayload);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5_000);

      try {
        const result = await supabase
          .from("quotes")
          .insert(insertPayload)
          .abortSignal(controller.signal);
        devLog("[quote-create] Supabase response:", result);

        if (result.error) throw new Error(result.error.message);
        // Built from the payload we sent plus the timestamps the row defaults
        // to, rather than read back from Postgres.
        return rowToQuote({
          ...insertPayload,
          created_at: now,
          updated_at: now,
        } as never);
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("Quote creation timed out after 5 seconds. Please try again.");
        }
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }

    },
    onSuccess: (quote) => {
      queryClient.setQueriesData({ queryKey: quoteDetailKey(quote.id) }, quote);
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
      onSuccess(quote);
    },
    onError: (error) => {
      toast.error("Could not create the quote", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });
}
