import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PricingCatalogRow } from "@/types/pricing";

const FIVE_MINUTES = 5 * 60 * 1000;

/** Fetches the active pricing catalog and normalizes it to `PricingCatalogRow`. */
async function fetchPricingCatalog(): Promise<PricingCatalogRow[]> {
  const { data, error } = await supabase
    .from("pricing_catalog")
    .select("*")
    .order("sku_id", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    sku_id: row.sku_id,
    name: row.name,
    category: row.category as PricingCatalogRow["category"],
    unit_price: Number(row.unit_price),
    unit_type: row.unit_type as PricingCatalogRow["unit_type"],
    tier_range: Array.isArray(row.tier_range)
      ? ([Number(row.tier_range[0]), Number(row.tier_range[1])] as [
          number,
          number,
        ])
      : null,
    effective_date: row.effective_date,
    expiration_date: row.expiration_date,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  }));
}

/** TanStack Query hook exposing the typed pricing catalog (5 min stale time). */
export function usePricingCatalog() {
  return useQuery({
    queryKey: ["pricing-catalog"],
    queryFn: fetchPricingCatalog,
    staleTime: FIVE_MINUTES,
  });
}
