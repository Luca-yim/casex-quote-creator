import { differenceInCalendarMonths, parseISO } from "date-fns";

/**
 * Timeline confidence tier derived from how far out the target go-live
 * date is relative to today.
 */
export type TimelineTier = "aggressive" | "standard" | "comfortable";

/**
 * Result of deriving a timeline tier from a target go-live date.
 */
export interface TimelineResult {
  /** Confidence tier, or null when no target date is set. */
  tier: TimelineTier | null;
  /** Whole calendar months between today and the target date. */
  monthsRemaining: number | null;
  /** Human-readable label for UI display. */
  displayLabel: string;
}

/**
 * Derives a timeline confidence tier from the target go-live date.
 *
 * Rules:
 * - No target date → tier is null.
 * - < 6 months remaining → aggressive.
 * - 6–9 months remaining → standard.
 * - 9+ months remaining → comfortable.
 *
 * @param targetGoLiveDate - ISO date string for the desired go-live, or null.
 * @param today - Reference date; defaults to the current system date.
 * @returns Timeline tier, months remaining, and a display label.
 */
export function deriveTimeline(
  targetGoLiveDate: string | null,
  today: Date = new Date()
): TimelineResult {
  if (!targetGoLiveDate) {
    return {
      tier: null,
      monthsRemaining: null,
      displayLabel: "No target go-live date set",
    };
  }

  const target = parseISO(targetGoLiveDate);
  const monthsRemaining = Math.max(0, differenceInCalendarMonths(target, today));

  let tier: TimelineTier;
  if (monthsRemaining < 6) {
    tier = "aggressive";
  } else if (monthsRemaining <= 9) {
    tier = "standard";
  } else {
    tier = "comfortable";
  }

  const monthWord = monthsRemaining === 1 ? "month" : "months";
  const tierLabel =
    tier === "aggressive"
      ? "Aggressive timeline"
      : tier === "standard"
        ? "Standard timeline"
        : "Comfortable timeline";

  return {
    tier,
    monthsRemaining,
    displayLabel: `${monthsRemaining} ${monthWord} out — ${tierLabel}`,
  };
}
