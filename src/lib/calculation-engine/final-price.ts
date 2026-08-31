import type { RepeatableActivation } from "@/types/quote";

/**
 * Discount for reusing an existing repeatable deployment.
 * full_match -10%, partial_match -5%, novel 0.
 * @returns the adjustment amount as a negative number (or 0).
 */
export function applyRepeatableActivationAdjustment(
  baseline: number,
  matchType: RepeatableActivation,
): number {
  switch (matchType) {
    case "full_match":
      return baseline * -0.1;
    case "partial_match":
      return baseline * -0.05;
    case "novel":
    default:
      return 0;
  }
}

/**
 * Grosses the adjusted baseline up to a sell price carrying `marginPercent`:
 * `adjustedBaseline / (1 - marginPercent / 100)`.
 * @throws when `marginPercent` is outside 0–100, or is exactly 100 (the
 * price would be undefined).
 */
export function applyMargin(
  adjustedBaseline: number,
  marginPercent: number,
): number {
  if (marginPercent < 0 || marginPercent >= 100) {
    throw new Error(
      `Margin must be between 0% and 100% (received ${marginPercent}%).`,
    );
  }
  return adjustedBaseline / (1 - marginPercent / 100);
}
