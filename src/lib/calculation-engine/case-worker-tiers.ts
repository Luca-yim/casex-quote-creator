import type { LineItem, PricingCatalogRow } from "@/types/pricing";
import { findTieredSku, toLineItem } from "./catalog-utils";

/**
 * Selects the case worker licensing tier (`cw_tier1` / `cw_tier2` / `cw_tier3`)
 * whose `tier_range` band contains `userCount`.
 * @returns the catalog row, or null when there are no case workers.
 */
export function selectCaseWorkerTier(
  userCount: number,
  catalog: PricingCatalogRow[],
): PricingCatalogRow | null {
  if (userCount <= 0) return null;
  return findTieredSku(catalog, "cw_tier", userCount);
}

/**
 * Case worker licensing line item: monthly recurring, priced per user at the
 * rate of the selected tier — `subtotal = tierUnitPrice * userCount`.
 * @returns null when `userCount` is 0 or no tier matches.
 */
export function calculateCaseWorkerLineItem(
  userCount: number,
  catalog: PricingCatalogRow[],
): LineItem | null {
  const tier = selectCaseWorkerTier(userCount, catalog);
  if (!tier) return null;
  return toLineItem(tier, userCount, `${userCount} case workers`);
}
