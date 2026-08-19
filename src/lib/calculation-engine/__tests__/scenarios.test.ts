import { describe, expect, it } from "vitest";
import { calculatePricingBreakdown } from "../baseline-calculator";
import { TEST_CATALOG, makeQuote } from "../__test-fixtures__/catalog";
import type { PricingQuoteInput } from "../baseline-calculator";

/**
 * Table-driven realistic configurations. Expected values are computed by
 * hand from the catalog fixture so a pricing regression fails loudly.
 */
interface Scenario {
  name: string;
  quote: Partial<PricingQuoteInput> & Record<string, unknown>;
  oneTime: number;
  monthly: number;
  baseline: number;
  final: number;
}

const SCENARIOS: Scenario[] = [
  {
    name: "small county, 3-year SOC-2 standard",
    quote: {},
    oneTime: 735_000,
    monthly: 25_865,
    baseline: 1_666_140,
    final: 2_082_675,
  },
  {
    name: "state agency, enterprise + FedRAMP, 5 years",
    // 975,000 one-time; cw 800*83.6=66,880; hosting 5*5,025=25,125;
    // support premium 45,000 -> monthly 137,005
    quote: {
      moduleTier: "enterprise",
      caseWorkerCount: 800,
      hostingModel: "fedramp",
      environmentCount: 5,
      supportTier: "premium",
      contractYears: 5,
      marginPercent: 25,
    },
    oneTime: 975_000,
    monthly: 137_005,
    baseline: 975_000 + 137_005 * 60,
    final: (975_000 + 137_005 * 60) / 0.75,
  },
  {
    name: "customer-hosted with B2C portal, full repeatable match",
    // cw 100*97.9=9,790; b2c pack3 4,167; support standard 10,000
    quote: {
      hostingModel: "customer_hosted",
      includeB2c: true,
      b2cMau: 25_000,
      repeatableActivation: "full_match",
      marginPercent: 15,
    },
    oneTime: 735_000,
    monthly: 23_957,
    baseline: 735_000 + 23_957 * 36,
    final: ((735_000 + 23_957 * 36) * 0.9) / 0.85,
  },
  {
    name: "B2B-heavy portal deal, partial match",
    // cw 300*97.9=29,370; b2b 1000*15=15,000; hosting 3*2,025=6,075;
    // support explicit enhanced 17,000 -> 67,445
    quote: {
      caseWorkerCount: 300,
      includeB2bPortal: true,
      b2bUserCount: 1000,
      supportTier: "enhanced",
      repeatableActivation: "partial_match",
      contractYears: 1,
      marginPercent: 30,
    },
    oneTime: 735_000,
    monthly: 67_445,
    baseline: 735_000 + 67_445 * 12,
    final: ((735_000 + 67_445 * 12) * 0.95) / 0.7,
  },
  {
    name: "CJIS compliance forces FedRAMP hosting on a SOC-2 selection",
    // cw 1200*56.1=67,320; hosting 3*5,025=15,075; support premium 45,000
    quote: {
      caseWorkerCount: 1200,
      hostingModel: "soc2",
      compliance: ["cjis"],
      supportTier: null,
      marginPercent: 10,
    },
    oneTime: 735_000,
    monthly: 127_395,
    baseline: 735_000 + 127_395 * 36,
    final: (735_000 + 127_395 * 36) / 0.9,
  },
];

describe.each(SCENARIOS)("scenario: $name", (scenario) => {
  const result = calculatePricingBreakdown(
    makeQuote(scenario.quote as never),
    TEST_CATALOG,
  );

  it("matches the expected one-time total", () => {
    expect(result.oneTimeTotal).toBeCloseTo(scenario.oneTime, 2);
  });

  it("matches the expected monthly recurring", () => {
    expect(result.monthlyRecurring).toBeCloseTo(scenario.monthly, 2);
  });

  it("matches the expected baseline TCV", () => {
    expect(result.baselineTCV).toBeCloseTo(scenario.baseline, 2);
  });

  it("matches the expected final TCV", () => {
    expect(result.finalTCV).toBeCloseTo(scenario.final, 2);
  });
});

describe("contract years", () => {
  it.each([
    [1, 735_000 + 25_865 * 12],
    [3, 735_000 + 25_865 * 36],
    [5, 735_000 + 25_865 * 60],
  ])("%i-year contract baseline", (years, expected) => {
    const result = calculatePricingBreakdown(
      makeQuote({ contractYears: years }),
      TEST_CATALOG,
    );
    expect(result.baselineTCV).toBeCloseTo(expected, 2);
  });
});

describe("environment count scaling", () => {
  it.each([1, 3, 5, 10])("bills SOC-2 hosting for %i environments", (count) => {
    const result = calculatePricingBreakdown(
      makeQuote({ environmentCount: count }),
      TEST_CATALOG,
    );
    expect(
      result.lineItems.find((i) => i.id === "hosting_soc2")?.subtotal,
    ).toBeCloseTo(2025 * count, 2);
  });

  it("skips hosting when the environment count is zero", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ environmentCount: 0 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id.startsWith("hosting_"))).toBe(false);
  });
});

describe("B2C MAU thresholds", () => {
  it.each([
    [500, "b2c_pack1"],
    [1000, "b2c_pack1"],
    [1001, "b2c_pack2"],
    [10_000, "b2c_pack2"],
    [10_001, "b2c_pack3"],
    [75_000, "b2c_pack4"],
    [150_000, "b2c_pack5"],
    [500_000, "b2c_pack5"],
  ])("%i MAU maps to %s", (mau, sku) => {
    const result = calculatePricingBreakdown(
      makeQuote({ includeB2c: true, b2cMau: mau }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === sku)).toBe(true);
  });
});
