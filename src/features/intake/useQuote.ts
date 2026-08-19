import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { rowToQuote } from "./quote-mapper";
import type { Quote } from "@/types/quote";
import type { AppRole } from "@/lib/auth";
import { devLog } from "@/lib/debug-log";
import { useAuth } from "@/lib/auth";
import { quoteSelectForRole } from "@/lib/quote-columns";

/** Fetches a single quote by id and maps it to the domain shape. */
export function useQuoteById(quoteId: string | undefined) {
  const { role } = useAuth();
  return useQuery({
    queryKey: ["quote", quoteId, role],
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
      if (role !== "sales_rep" && role !== "external") {
        throw new Error("Your role cannot create quotes from this page.");
      }

      const insertPayload = {
        requested_by: userId,
        owner_id: role === "sales_rep" ? userId : null,
        tier: "ballpark" as const,
        state: "draft" as const,
        name: "Untitled Quote",
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
      queryClient.setQueryData(["quote", quote.id], quote);
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
