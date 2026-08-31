import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { LeadStatus } from "./types";

type LeadUpdate = Database["public"]["Tables"]["lead_intakes"]["Update"];

async function updateLead(id: string, patch: LeadUpdate): Promise<void> {
  const { error } = await supabase.from("lead_intakes").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Mutations for the lead queue. Every mutation invalidates both the paginated
 * queue and the status counts, matching the pipeline's cache-key pattern.
 */
export function useLeadActions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lead-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["lead-stats"] });
  };

  const claim = useMutation({
    mutationFn: async (leadId: string) => {
      const userId = user?.id;
      if (!userId) throw new Error("You must be signed in to claim a lead");
      // All four fields move together — a partial claim would leave the row
      // in a state the queue's "unclaimed" test cannot reason about.
      await updateLead(leadId, {
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
        assigned_rep_id: userId,
        status: "claimed" satisfies LeadStatus,
      });
    },
    onSuccess: () => {
      toast.success("Lead claimed");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assign = useMutation({
    mutationFn: async ({ leadId, repId }: { leadId: string; repId: string }) => {
      // Assignment never touches claimed_by/claimed_at — who picked it up is
      // a historical fact, ownership is not.
      await updateLead(leadId, { assigned_rep_id: repId });
    },
    onSuccess: () => {
      toast.success("Lead assigned");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: LeadStatus }) => {
      await updateLead(leadId, { status });
    },
    onSuccess: () => {
      toast.success("Lead status updated");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markDuplicate = useMutation({
    mutationFn: async ({
      leadId,
      duplicateOfLeadId,
    }: {
      leadId: string;
      duplicateOfLeadId: string;
    }) => {
      if (!duplicateOfLeadId) throw new Error("Select the lead this duplicates");
      if (duplicateOfLeadId === leadId) throw new Error("A lead cannot duplicate itself");
      await updateLead(leadId, {
        status: "duplicate" satisfies LeadStatus,
        duplicate_of_lead_id: duplicateOfLeadId,
      });
    },
    onSuccess: () => {
      toast.success("Marked as duplicate");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return { claim, assign, setStatus, markDuplicate };
}
