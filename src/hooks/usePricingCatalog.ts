import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PricingCatalogRow } from "@/types/pricing";
import { useAuth } from "@/lib/auth";
import { shouldHidePricingData } from "@/lib/quote-columns";

const FIVE_MINUTES = 5 * 60 * 1000;

/** Fetches the active pricing catalog and normalizes it to `PricingCatalogRow`. */
async function fetchPricingCatalog(hidePricing = false): Promise<PricingCatalogRow[]> {
  // External users still need the catalog for option labels/tier ranges, but
  // must never receive unit rates — so they get an explicit safe projection.
  const columns = hidePricing
    ? "sku_id, name, category, unit_type, tier_range, effective_date, expiration_date"
    : "*";

  const { data, error } = await supabase
    .from("pricing_catalog")
    .select(columns)
    .order("sku_id", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row) => ({
    sku_id: row.sku_id,
    name: row.name,
    category: row.category as PricingCatalogRow["category"],
    unit_price: hidePricing ? 0 : Number(row.unit_price),
    unit_type: row.unit_type as PricingCatalogRow["unit_type"],
    tier_range: Array.isArray(row.tier_range)
      ? ([Number(row.tier_range[0]), Number(row.tier_range[1])] as [
          number,
          number,
        ])
      : null,
    effective_date: row.effective_date,
    expiration_date: row.expiration_date,
    metadata: hidePricing ? {} : ((row.metadata as Record<string, unknown> | null) ?? {}),
  }));
}

/**
 * TanStack Query hook exposing the typed pricing catalog (5 min stale time).
 *
 * Gated on the role being resolved for the same reason as `useQuoteById`: the
 * projection depends on `hidePricing`, so an early fetch would be discarded
 * and refetched once the profile lands.
 */
export function usePricingCatalog() {
  const { role, loading, profileLoading } = useAuth();
  const roleResolved = !loading && !profileLoading && role !== null;
  const hidePricing = shouldHidePricingData(role);
  return useQuery({
    queryKey: ["pricing-catalog", hidePricing],
    queryFn: () => fetchPricingCatalog(hidePricing),
    enabled: roleResolved,
    staleTime: FIVE_MINUTES,
  });
}

