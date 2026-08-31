import { describe, expect, it } from "vitest";
import {
  MARGIN_SCENARIOS,
  grandTotalCost,
  marginScenarios,
  suggestedContingency,
  totalImplementationFee,
} from "../fullQuote";
import {
  confidence,
  integrationLevel,
  migrationLevel,
  scoreComplexity,
  tierForScore,
} from "../complexity";
import { ballparkRange, type BallparkSizingRow } from "../ballpark";

describe("grandTotalCost", () => {
  it("returns 0 for empty inputs", () => {
    expect(grandTotalCost([], [])).toBe(0);
  });
});

describe("marginScenarios", () => {
  it("never divides by zero hours", () => {
    const scenarios = marginScenarios(100_000, 0);
    expect(scenarios).toHaveLength(MARGIN_SCENARIOS.length);
    for (const s of scenarios) {
      expect(s.blendedRate).toBe(0);
      expect(Number.isFinite(s.revenue)).toBe(true);
    }
  });
});

describe("totalImplementationFee", () => {
  it("returns cost plus contingency at 0% margin", () => {
    expect(totalImplementationFee(0, 1_000_000, 0.05)).toBeCloseTo(1_050_000, 2);
  });

  it("is unbounded at 100% margin with positive cost", () => {
    expect(totalImplementationFee(100, 1_000_000, 0)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("is 0 at 100% margin with zero cost", () => {
    expect(totalImplementationFee(100, 0, 0.05)).toBe(0);
  });
});

describe("suggestedContingency", () => {
  it("returns the 3% baseline with no drivers", () => {
    expect(
      suggestedContingency({
        migrationComplexity: "low",
        hasUndocumentedIntegration: false,
        complianceComplexity: "high",
      }),
    ).toBeCloseTo(0.03, 5);
  });

  it("stacks every driver", () => {
    expect(
      suggestedContingency({
        migrationComplexity: "very_high",
        hasUndocumentedIntegration: true,
        complianceComplexity: "very_high",
      }),
    ).toBeCloseTo(0.1, 5);
  });
});

describe("complexity", () => {
  it("maps thresholds", () => {
    expect(integrationLevel(0)).toBe("none");
    expect(integrationLevel(4)).toBe("medium");
    expect(integrationLevel(12)).toBe("very_high");
    expect(migrationLevel(500)).toBe("low");
    expect(migrationLevel(2_000_000)).toBe("very_high");
  });

  it("maps score bands to tiers", () => {
    expect(tierForScore(0)).toBe(1);
    expect(tierForScore(4)).toBe(1);
    expect(tierForScore(5)).toBe(2);
    expect(tierForScore(14)).toBe(3);
    expect(tierForScore(20)).toBe(4);
  });

  it("caps the maximum score at 20", () => {
    const result = scoreComplexity({
      integration: "very_high",
      migration: "very_high",
      identity: "very_high",
      portal: "very_high",
      compliance: "very_high",
    });
    expect(result.totalScore).toBe(20);
    expect(result.tier).toBe(4);
  });

  it("floors confidence at 40", () => {
    const answers = Array.from({ length: 30 }, () => ({
      notSure: true,
      undocumented: true,
    }));
    expect(confidence(answers)).toBe(40);
    expect(confidence([])).toBe(100);
  });
});

describe("ballparkRange", () => {
  const sizing: BallparkSizingRow[] = [
    {
      tier: 1,
      program_type: "commercial",
      hours_low: 2_000,
      hours_high: 5_000,
      rate_low: 60,
      rate_high: 75,
    },
  ];

  it("does not widen at 100% confidence", () => {
    const range = ballparkRange(1, "commercial", 100, sizing);
    expect(range.implementationLow).toBeCloseTo(120_000, 2);
    expect(range.implementationHigh).toBeCloseTo(375_000, 2);
  });

  it("throws when no sizing row matches", () => {
    expect(() => ballparkRange(4, "commercial", 90, sizing)).toThrow();
  });
});
