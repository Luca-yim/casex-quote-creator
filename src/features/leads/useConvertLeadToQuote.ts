import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { Lead } from "./lead-mapper";
import type { LeadStatus } from "./types";

/** Lead-intake hosting answers → the quote's hosting model vocabulary. */
const HOSTING_MAP: Record<string, string | null> = {
  cloud: "soc2",
  govcloud: "fedramp",
  customer_hosted: "customer_hosted",
  unsure: null,
};

/** Lead-intake difficulty answers → the quote's integration difficulty scale. */
const DIFFICULTY_MAP: Record<string, string | null> = {
  low: "simple",
  medium: "moderate",
  high: "complex",
  unsure: null,
};

/** Lead-intake compliance checkboxes → quote compliance codes. */
const COMPLIANCE_MAP: Record<string, string> = {
  soc2: "soc2_type2",
  hipaa: "hipaa",
  fedramp_moderate: "fedramp_moderate",
  fedramp_high: "fedramp_high",
  cjis: "cjis",
  stateramp: "stateramp",
  irs_1075: "irs_1075",
};

function mapCompliance(values: string[]): string[] {
  return values
    .filter((value) => value !== "none")
    .map((value) => COMPLIANCE_MAP[value])
    .filter((value): value is string => Boolean(value));
}

/**
 * Converts a qualified lead into a ballpark draft quote.
 *
 * The quote row is written first, then the lead is linked back to it. If the
 * link-back fails the mutation rejects loudly rather than leaving an orphaned
 * quote silently behind.
 */
export function useConvertLeadToQuote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (lead: Lead): Promise<string> => {
      const userId = user?.id;
      if (!userId) throw new Error("You must be signed in to convert a lead");

      const quoteId = crypto.randomUUID();
      const insertPayload = {
        id: quoteId,
        requested_by: userId,
        owner_id: userId,
        lead_id: lead.id,
        tier: "ballpark" as const,
        state: "draft" as const,
        name: lead.organizationName,
        margin_percent: 20,
        contract_years: 3,
        customer_name: lead.organizationName,
        customer_email: lead.contactEmail,
        vertical: lead.vertical,
        solution: lead.solution,
        vertical_other_detail: (lead as Lead & { verticalOtherDetail?: string | null })
          .verticalOtherDetail ?? null,
        case_worker_count: lead.internalUserCount,
        include_b2c: lead.externalPortalRequired,
        b2c_mau: lead.externalPortalMonthlyLogins,
        include_b2b_portal: lead.b2bPortalRequired,
        b2b_user_count: lead.b2bUserCount,
        hosting_model: lead.hostingPreference
          ? HOSTING_MAP[lead.hostingPreference] ?? null
          : null,
        has_integrations: lead.integrationRequired,
        integration_count: lead.integrationCount,
        integration_difficulty: lead.integrationDifficulty
          ? DIFFICULTY_MAP[lead.integrationDifficulty] ?? null
          : null,
        compliance: mapCompliance(lead.complianceRequirements),
      };

      const insert = await supabase.from("quotes").insert(insertPayload as never);
      if (insert.error) throw new Error(insert.error.message);

      const link = await supabase
        .from("lead_intakes")
        .update({
          status: "converted_to_ballpark" satisfies LeadStatus,
          converted_quote_id: quoteId,
        })
        .eq("id", lead.id);
      if (link.error) {
        throw new Error(
          `Quote ${quoteId} was created, but the lead could not be linked to it: ${link.error.message}`,
        );
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
