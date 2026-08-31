import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/** One WBS row as stored. `person_days` is DB-generated and read-only. */
export interface WbsLineRow {
  id: string;
  phase: string;
  area: string | null;
  role: string;
  location: string;
  costHours: number;
  revenueHours: number;
  costRate: number;
  billRate: number;
  personDays: number | null;
}

/** One itemized non-labor cost row. */
export interface CostItemRow {
  id: string;
  name: string;
  itemType: string;
  amount: number;
  customerVisible: boolean;
}

/** A distinct role/location pairing available on the active rate card. */
export interface RateCardOption {
  role: string;
  location: string;
  billRate: number;
  costRate: number;
}

export const KEY = {
  lines: (quoteId: string) => ["wbs-lines", quoteId] as const,
  items: (quoteId: string) => ["wbs-cost-items", quoteId] as const,
  rates: (programType: string | null) => ["rate-cards", programType] as const,
  phases: ["phase-weight-allocation"] as const,
};

/** True when the signed-in user is allowed to touch WBS data at all. */
function useWbsAllowed() {
  const { role, loading, profileLoading } = useAuth();
  return {
    allowed: role === "estimator" || role === "admin",
    ready: !loading && !profileLoading,
  };
}

/**
 * Reads WBS labor lines for one quote. Extracted from the hook so non-hook
 * callers (PDF generation) can prime the exact same query key.
 */
export async function fetchWbsLines(quoteId: string): Promise<WbsLineRow[]> {
  const { data, error } = await supabase
    .from("quote_wbs_lines")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    phase: r.phase,
    area: r.area,
    role: r.role,
    location: r.location,
    costHours: Number(r.cost_hours),
    revenueHours: Number(r.revenue_hours),
    costRate: Number(r.cost_rate),
    billRate: Number(r.bill_rate),
    personDays: r.person_days === null ? null : Number(r.person_days),
  }));
}

/** WBS labor lines for one quote. RLS restricts this to estimator/admin. */
export function useWbsLines(quoteId: string, enabled = true) {
  const { allowed, ready } = useWbsAllowed();
  return useQuery({
    queryKey: KEY.lines(quoteId),
    enabled: enabled && ready && allowed && Boolean(quoteId),
    queryFn: () => fetchWbsLines(quoteId),
  });
}

/** Reads non-labor cost items for one quote. Shared with PDF generation. */
export async function fetchQuoteCostItems(quoteId: string): Promise<CostItemRow[]> {
  const { data, error } = await supabase
    .from("quote_cost_items")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    itemType: r.cost_type,
    amount: Number(r.amount),
    customerVisible: Boolean(r.is_customer_visible),
  }));
}

/** Non-labor cost items for one quote. */
export function useQuoteCostItems(quoteId: string, enabled = true) {
  const { allowed, ready } = useWbsAllowed();
  return useQuery({
    queryKey: KEY.items(quoteId),
    enabled: enabled && ready && allowed && Boolean(quoteId),
    queryFn: () => fetchQuoteCostItems(quoteId),
  });
}

/**
 * Distinct role/location pairs on the currently effective rate card for a
 * program type. Rates are read here only to be snapshotted into the WBS row
 * at insert time — lines never hold a live reference.
 */
export function useRateCardOptions(programType: string | null, enabled = true) {
  const { allowed, ready } = useWbsAllowed();
  return useQuery({
    queryKey: KEY.rates(programType),
    enabled: enabled && ready && allowed && Boolean(programType),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RateCardOption[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("rate_cards")
        .select("role, location, bill_rate, cost_rate, effective_end")
        .eq("program_type", programType as string)
        .or(`effective_end.is.null,effective_end.gt.${today}`);
      if (error) throw new Error(error.message);
      const seen = new Map<string, RateCardOption>();
      for (const r of data ?? []) {
        const key = `${r.role}|${r.location}`;
        if (!seen.has(key)) {
          seen.set(key, {
            role: r.role,
            location: r.location,
            billRate: Number(r.bill_rate),
            costRate: Number(r.cost_rate),
          });
        }
      }
      return [...seen.values()].sort(
        (a, b) => a.role.localeCompare(b.role) || a.location.localeCompare(b.location),
      );
    },
  });
}

/** Phase names, used to seed the phase picker for consistent naming. */
export function usePhaseOptions(enabled = true) {
  const { allowed, ready } = useWbsAllowed();
  return useQuery({
    queryKey: KEY.phases,
    enabled: enabled && ready && allowed,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("phase_weight_allocation")
        .select("phase_name, display_order")
        .order("display_order", { ascending: true });
      if (error) throw new Error(error.message);
      return [...new Set((data ?? []).map((r) => r.phase_name))];
    },
  });
}

export interface NewWbsLine {
  phase: string;
  area: string | null;
  role: string;
  location: string;
  costHours: number;
  revenueHours: number;
  /** Snapshotted from the rate card at insert time. */
  costRate: number;
  billRate: number;
}

/** Insert a WBS line with its rates frozen at insert time. */
export function useAddWbsLine(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (line: NewWbsLine) => {
      const { error } = await supabase.from("quote_wbs_lines").insert({
        quote_id: quoteId,
        phase: line.phase,
        area: line.area,
        role: line.role,
        location: line.location,
        cost_hours: line.costHours,
        revenue_hours: line.revenueHours,
        cost_rate: line.costRate,
        bill_rate: line.billRate,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.lines(quoteId) }),
    onError: (e: Error) => toast.error("Could not add line", { description: e.message }),
  });
}

/** Delete a WBS line. */
export function useDeleteWbsLine(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quote_wbs_lines").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.lines(quoteId) }),
    onError: (e: Error) =>
      toast.error("Could not delete line", { description: e.message }),
  });
}

export interface NewCostItem {
  name: string;
  itemType: string;
  amount: number;
  customerVisible: boolean;
}

/** Insert a non-labor cost item. */
export function useAddCostItem(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: NewCostItem) => {
      const { error } = await supabase.from("quote_cost_items").insert({
        quote_id: quoteId,
        name: item.name,
        cost_type: item.itemType,
        amount: item.amount,
        is_customer_visible: item.customerVisible,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.items(quoteId) }),
    onError: (e: Error) => toast.error("Could not add cost item", { description: e.message }),
  });
}

/** Delete a non-labor cost item. */
export function useDeleteCostItem(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quote_cost_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY.items(quoteId) }),
    onError: (e: Error) =>
      toast.error("Could not delete cost item", { description: e.message }),
  });
}
