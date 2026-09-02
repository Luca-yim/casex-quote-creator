import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Lead } from "./lead-mapper";

/**
 * Converts a claimed lead into a ballpark draft quote.
 *
 * All field mapping (hosting, difficulty, compliance) and the lead link-back
 * happen atomically inside the `convert_lead_to_quote` database function, so
 * a partial conversion is no longer possible.
 */
export function useConvertLeadToQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Lead): Promise<string> => {
      const { data, error } = await supabase.rpc("convert_lead_to_quote", {
        p_lead_id: lead.id,
      });
      if (error) throw new Error(error.message);
      const quoteId = (data as { id: string } | null)?.id;
      if (!quoteId) {
        throw new Error("convert_lead_to_quote returned an unexpected result");
      }
      return quoteId;
    },
    onSuccess: () => {
      toast.success("Lead converted to a ballpark quote");
      void queryClient.invalidateQueries({ queryKey: ["lead-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["lead-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
