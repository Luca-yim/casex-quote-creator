import type { LineItem, PricingCatalogRow } from "@/types/pricing";
import type { SupportTier } from "@/types/quote";
import { findSku, toLineItem } from "./catalog-utils";

/**
 * Recommends a support tier from total platform user count.
 * <=100 -> standard, 101-300 -> enhanced, 301+ -> premium.
 */
export function recommendSupportTier(totalUserCount: number): SupportTier {
  if (totalUserCount <= 100) return "standard";
  if (totalUserCount <= 300) return "enhanced";
  return "premium";
}

/**
 * Support line item for the given tier (`support_standard` etc.).
 * Flat monthly fee, quantity 1.
 * @returns null when the catalog has no SKU for the tier.
 */
export function calculateSupportLineItem(
  tier: SupportTier,
  catalog: PricingCatalogRow[],
): LineItem | null {
  const row = findSku(catalog, `support_${tier}`);
  if (!row) return null;
  return toLineItem(row, 1, `${tier} support`);
}
