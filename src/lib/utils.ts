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
  amount: number | null | undefined,
  options: { decimals?: number; compact?: boolean } = {}
): string {
  const { decimals = 0, compact = false } = options;

  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }

  // Sign is rendered outside the "$" so negatives read as -$1.5M.
  const sign = amount < 0 ? "-" : "";
  const magnitude = Math.abs(amount);

  if (compact && magnitude >= 1_000_000) {
    const millions = magnitude / 1_000_000;
    return `${sign}$${millions.toFixed(1).replace(/\.0$/, "")}M`;
  }

  if (compact && magnitude >= 1_000) {
    const thousands = magnitude / 1_000;
    return `${sign}$${thousands.toFixed(1).replace(/\.0$/, "")}K`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Formats a byte count using binary thresholds (1 KB = 1024 B).
 *
 * @param bytes - Size in bytes.
 * @param decimals - Decimal places for KB and above; defaults to 1.
 * @returns A human-readable size string, e.g. "1.4 MB".
 */
export function formatFileSize(
  bytes: number | null | undefined,
  decimals = 1
): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(decimals).replace(/\.0+$/, "")} ${units[unitIndex]}`;
}

/**
 * Formats a timestamp as a coarse "time ago" string.
 *
 * @param value - Date, ISO string or epoch milliseconds.
 * @param now - Reference point; defaults to the current time.
 * @returns e.g. "just now", "5 minutes ago", "3 days ago".
 */
export function formatRelativeTime(
  value: Date | string | number | null | undefined,
  now: Date = new Date()
): string {
  if (value === null || value === undefined) return "—";
  const then = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(then.getTime())) return "—";

  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 0) return "just now";

  const units: [limit: number, secondsPer: number, label: string][] = [
    [45, 1, "second"],
    [90 * 60, 60, "minute"],
    [36 * 3600, 3600, "hour"],
    [30 * 86_400, 86_400, "day"],
    [365 * 86_400, 2_592_000, "month"],
  ];

  if (seconds < 45) return "just now";
  for (const [limit, secondsPer, label] of units) {
    if (seconds < limit) {
      const count = Math.floor(seconds / secondsPer);
      return `${count} ${label}${count === 1 ? "" : "s"} ago`;
    }
  }
  const years = Math.floor(seconds / (365 * 86_400));
  return `${years} year${years === 1 ? "" : "s"} ago`;
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
