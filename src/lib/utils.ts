import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes, resolving conflicts using tailwind-merge.
 *
 * @param inputs - Class values to merge.
 * @returns A single deduplicated class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as US dollars.
 *
 * @param amount - The numeric amount to format.
 * @param options - Formatting options.
 * @returns A formatted currency string.
 */
export function formatCurrency(
  amount: number,
  options: { decimals?: number; compact?: boolean } = {}
): string {
  const { decimals = 0, compact = false } = options;

  if (compact && Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `$${millions.toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (compact && Math.abs(amount) >= 1_000) {
    const thousands = amount / 1_000;
    return `$${thousands.toFixed(1).replace(/\.0$/, "")}K`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Formats a number with grouped thousands and a fixed number of decimals.
 *
 * @param value - The number to format.
 * @param decimals - Number of decimal places; defaults to 0.
 * @returns A formatted number string.
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
