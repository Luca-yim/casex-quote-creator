/**
 * Pricing domain types for the CaseX pricing calculation engine.
 * All catalog data flows through these shapes as plain parameters.
 */

/** Billing cadence of a catalog SKU. */
export type PricingCategory = "one_time" | "monthly";

/** How a SKU's unit price is multiplied out. */
export type PricingUnitType = "flat" | "per_user" | "per_instance";

/** A single row of the Supabase `pricing_catalog` table. */
export interface PricingCatalogRow {
  sku_id: string;
  name: string;
  category: PricingCategory;
  unit_price: number;
  /** Inclusive [min, max] band this SKU applies to, when tiered. */
  tier_range: [number, number] | null;
  unit_type: PricingUnitType;
  effective_date: string;
  expiration_date: string | null;
  metadata: Record<string, unknown>;
}

/** One computed row of a quote's price breakdown. */
export interface LineItem {
  /** `sku_id` when catalog-derived, otherwise a stable derived id. */
  id: string;
  label: string;
  category: PricingCategory;
  unitPrice: number;
  quantity: number;
  /** Always `unitPrice * quantity`. */
  subtotal: number;
  notes?: string;
}

/** Full computed pricing result for a quote. */
export interface PricingBreakdown {
  lineItems: LineItem[];
  oneTimeTotal: number;
  monthlyRecurring: number;
  /** `monthlyRecurring * 12` */
  annualRecurring: number;
  contractYears: number;
  /** `oneTimeTotal + monthlyRecurring * 12 * contractYears` */
  baselineTCV: number;
  /** Negative number (or 0) applied to `baselineTCV`. */
  repeatableActivationAdjustment: number;
  /** `baselineTCV + repeatableActivationAdjustment` */
  adjustedBaseline: number;
  marginPercent: number;
  /** `adjustedBaseline / (1 - marginPercent / 100)` */
  finalTCV: number;
}
