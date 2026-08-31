import { describe, expect, it } from "vitest";
import { confidence, scoreComplexity } from "../complexity";
import { ballparkRange, type BallparkSizingRow } from "../ballpark";

/**
 * Alaska DOLWD Workers' Comp ballpark fixture. Driver judgments:
 * Integration medium, Migration medium (assumed), Identity high,
 * Portal medium, Compliance high (judgment override) => score 12,
 * tier 3, public sector, 75% confidence.
 */
const sizing: BallparkSizingRow[] = [
  {
    tier: 3,
    program_type: "public_sector",
    hours_low: 30_000,
    hours_high: 45_000,
    rate_low: 70,
    rate_high: 85,
  },
];

describe("Alaska DOLWD ballpark", () => {
  it("scores the drivers into tier 3", () => {
    const result = scoreComplexity({
      integration: "medium",
      migration: "medium",
      identity: "high",
      portal: "medium",
      compliance: "high",
    });
    expect(result.totalScore).toBe(12);
    expect(result.tier).toBe(3);
  });

  it("derives 75% confidence from five not-sure answers", () => {
    const answers = Array.from({ length: 5 }, () => ({
      notSure: true,
      undocumented: false,
    }));
    expect(confidence(answers)).toBe(75);
  });

  it("widens the tier band by the confidence spread", () => {
    const range = ballparkRange(3, "public_sector", 75, sizing);
    expect(range.implementationLow).toBeCloseTo(1_837_500, 0);
    expect(range.implementationHigh).toBeCloseTo(4_303_125, 0);
  });
});
