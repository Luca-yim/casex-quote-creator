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

/** Fetches a single quote by id and maps it to the domain shape. */
export function useQuoteById(quoteId: string | undefined) {
  const { role } = useAuth();
  return useQuery({
    queryKey: [...quoteDetailKey(quoteId), role],
    enabled: Boolean(quoteId),
    queryFn: async (): Promise<Quote> => {
      const { data, error } = await supabase
        .from("quotes")
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

      const insertPayload = {
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
          .select("*")
          .abortSignal(controller.signal)
          .single();
        devLog("[quote-create] Supabase response:", result);

        if (result.error) throw new Error(result.error.message);
        return rowToQuote(result.data);
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
