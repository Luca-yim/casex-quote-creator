import type { LineItem, PricingCatalogRow } from "@/types/pricing";

/**
 * Finds a catalog row by exact `sku_id`.
 * @returns the row, or null when the catalog does not carry that SKU.
 */
export function findSku(
  catalog: PricingCatalogRow[],
  skuId: string,
): PricingCatalogRow | null {
  return catalog.find((row) => row.sku_id === skuId) ?? null;
}

/**
 * Finds the tiered row whose inclusive `tier_range` band contains `value`.
 * Rows without a `tier_range` are ignored. Rows are matched among those whose
 * `sku_id` starts with `prefix`.
 */
export function findTieredSku(
  catalog: PricingCatalogRow[],
  prefix: string,
  value: number,
): PricingCatalogRow | null {
  const candidates = catalog
    .filter((row) => row.sku_id.startsWith(prefix) && row.tier_range !== null)
    .sort((a, b) => (a.tier_range![0] ?? 0) - (b.tier_range![0] ?? 0));

  const match = candidates.find(
    (row) => value >= row.tier_range![0] && value <= row.tier_range![1],
  );
  if (match) return match;

  // Above the top band: fall back to the highest tier so pricing never gaps.
  const highest = candidates[candidates.length - 1];
  if (highest && value > highest.tier_range![1]) return highest;
  return null;
}

/**
 * Builds a line item from a catalog row: `subtotal = unit_price * quantity`.
 * Returns null for non-positive quantities so callers can skip empty items.
 */
export function toLineItem(
  row: PricingCatalogRow,
  quantity: number,
  notes?: string,
): LineItem | null {
  if (quantity <= 0) return null;
  return {
    id: row.sku_id,
    label: row.name,
    category: row.category,
    unitPrice: row.unit_price,
    quantity,
    subtotal: row.unit_price * quantity,
    ...(notes ? { notes } : {}),
  };
}
