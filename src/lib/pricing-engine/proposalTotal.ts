/**
 * Proposal-tier total composition. Pure functions only.
 *
 * A Proposal price is made of two independent parts:
 *  - the WBS-derived implementation fee (margin + contingency already applied
 *    by `totalImplementationFee`), and
 *  - the catalog subscription side (one-time catalog items plus recurring
 *    items), priced at catalog or NASPO price.
 *
 * Margin is applied exactly once: it lives inside the implementation fee and
 * is NOT re-applied to catalog recurring items. Contingency is likewise
 * implementation-only.
 */

export const MIN_CONTRACT_YEARS = 1;
export const MAX_CONTRACT_YEARS = 10;
export const DEFAULT_CONTRACT_YEARS = 3;

/** Clamps any stored/user value to a whole number of years in 1..10. */
export function normalizeContractYears(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_CONTRACT_YEARS;
  if (n < MIN_CONTRACT_YEARS) return MIN_CONTRACT_YEARS;
  if (n > MAX_CONTRACT_YEARS) return MAX_CONTRACT_YEARS;
  return n;
}

/** The catalog-side figures a Proposal total needs, as produced by the engine. */
export interface ProposalCatalogInput {
  oneTimeTotal: number;
  monthlyRecurring: number;
  contractYears: number;
  naspoDiscountApplied: boolean;
}

/** Structured Proposal total. Shaped so PDF and a future Excel export share it. */
export interface ProposalTotals {
  /** WBS implementation fee (margin + contingency applied). */
  implementationFee: number;
  /** One-time catalog line items. */
  catalogOneTime: number;
  /** `implementationFee + catalogOneTime` */
  oneTimeSubtotal: number;
  monthlyRecurring: number;
  /** `monthlyRecurring * 12` */
  annualRecurring: number;
  /** Whole years, 1..10. */
  contractYears: number;
  /** `annualRecurring * contractYears` */
  multiYearRecurring: number;
  /** `oneTimeSubtotal + multiYearRecurring` */
  proposalTotal: number;
  /** True when NASPO cooperative prices fed the catalog side. */
  naspoDiscountApplied: boolean;
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * Composes the binding Proposal total from the implementation fee and the
 * catalog breakdown. Never mutates or re-derives the implementation fee.
 */
export function computeProposalTotals(
  implementationFee: number,
  catalog: ProposalCatalogInput,
): ProposalTotals {
  const fee = Number.isFinite(implementationFee) ? implementationFee : 0;
  const catalogOneTime = safe(catalog.oneTimeTotal);
  const monthlyRecurring = safe(catalog.monthlyRecurring);
  const contractYears = normalizeContractYears(catalog.contractYears);

  const oneTimeSubtotal = fee + catalogOneTime;
  const annualRecurring = monthlyRecurring * 12;
  const multiYearRecurring = annualRecurring * contractYears;

  return {
    implementationFee: fee,
    catalogOneTime,
    oneTimeSubtotal,
    monthlyRecurring,
    annualRecurring,
    contractYears,
    multiYearRecurring,
    proposalTotal: oneTimeSubtotal + multiYearRecurring,
    naspoDiscountApplied: catalog.naspoDiscountApplied,
  };
}
