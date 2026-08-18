import type { LineItem, PricingCatalogRow } from "@/types/pricing";
import { findTieredSku, toLineItem } from "./catalog-utils";

/**
 * Selects the B2C portal pack (`b2c_pack_1` … `b2c_pack_5`) whose `tier_range`
 * band contains the given monthly active user count.
 * @returns the catalog row, or null when MAU is 0 or nothing matches.
 */
export function selectB2cPack(
  mau: number,
  catalog: PricingCatalogRow[],
): PricingCatalogRow | null {
  if (mau <= 0) return null;
  return findTieredSku(catalog, "b2c_pack", mau);
}

/**
 * B2C portal line item: a flat monthly pack fee (quantity 1) sized by MAU.
 * @returns null when MAU is 0 or no pack matches.
 */
export function calculateB2cLineItem(
  mau: number,
  catalog: PricingCatalogRow[],
): LineItem | null {
  const pack = selectB2cPack(mau, catalog);
  if (!pack) return null;
  const quantity = pack.unit_type === "per_user" ? mau : 1;
  return toLineItem(pack, quantity, `${mau.toLocaleString()} MAU`);
}
