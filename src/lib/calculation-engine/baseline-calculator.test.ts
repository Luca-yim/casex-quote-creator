import { describe, expect, it } from "vitest";
import { calculatePricingBreakdown } from "./baseline-calculator";
import { TEST_CATALOG, makeQuote } from "./__test-fixtures__/catalog";

/**
 * Hand-computed reference case:
 * module_standard 735,000 one-time
 * cw_tier1 100 * 97.90 = 9,790/mo
 * hosting_soc2 3 * 2,025 = 6,075/mo
 * support_standard 10,000/mo
 * monthly = 25,865 -> 36 months = 931,140
 * baseline = 1,666,140 ; novel -> adj 0 ; 20% margin -> 2,082,675
 */
describe("calculatePricingBreakdown — reference quote", () => {
  const result = calculatePricingBreakdown(makeQuote(), TEST_CATALOG);

  it("computes the one-time total", () => {
    expect(result.oneTimeTotal).toBe(735_000);
  });

  it("computes the monthly recurring total", () => {
    expect(result.monthlyRecurring).toBeCloseTo(25_865, 2);
  });

  it("computes the annual recurring total", () => {
    expect(result.annualRecurring).toBeCloseTo(310_380, 2);
  });

  it("computes the baseline TCV", () => {
    expect(result.baselineTCV).toBeCloseTo(1_666_140, 2);
  });

  it("applies no repeatable activation adjustment for novel", () => {
    expect(result.repeatableActivationAdjustment).toBe(0);
    expect(result.adjustedBaseline).toBeCloseTo(1_666_140, 2);
  });

  it("computes the final TCV at 20% margin", () => {
    expect(result.finalTCV).toBeCloseTo(2_082_675, 2);
  });

  it("emits one line item per priced component", () => {
    expect(result.lineItems.map((i) => i.id)).toEqual([
      "module_standard",
      "cw_tier1",
      "hosting_soc2",
      "support_standard",
    ]);
  });
});

describe("repeatable activation", () => {
  it("full_match reduces the baseline by 10%", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ repeatableActivation: "full_match" }),
      TEST_CATALOG,
    );
    expect(result.repeatableActivationAdjustment).toBeCloseTo(-166_614, 2);
    expect(result.adjustedBaseline).toBeCloseTo(1_499_526, 2);
  });

  it("partial_match reduces the baseline by 5%", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ repeatableActivation: "partial_match" }),
      TEST_CATALOG,
    );
    expect(result.adjustedBaseline).toBeCloseTo(1_666_140 * 0.95, 2);
  });
});

describe("module tier", () => {
  it("enterprise tier uses the $975K module", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ moduleTier: "enterprise" }),
      TEST_CATALOG,
    );
    expect(result.oneTimeTotal).toBe(975_000);
  });

  it("skips the module line item when no tier is selected", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ moduleTier: null }),
      TEST_CATALOG,
    );
    expect(result.oneTimeTotal).toBe(0);
    expect(result.lineItems.some((i) => i.id.startsWith("module_"))).toBe(false);
  });
});

describe("hosting", () => {
  it("FedRAMP hosting bills $5,025 per instance", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ hostingModel: "fedramp" }),
      TEST_CATALOG,
    );
    const hosting = result.lineItems.find((i) => i.id === "hosting_fedramp");
    expect(hosting?.unitPrice).toBe(5025);
    expect(hosting?.subtotal).toBe(15_075);
  });

  it("customer-hosted adds no hosting line item", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ hostingModel: "customer_hosted" }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id.startsWith("hosting_"))).toBe(false);
  });

  it("FedRAMP High compliance forces FedRAMP hosting", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ hostingModel: "soc2", compliance: ["fedramp_high"] }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "hosting_fedramp")).toBe(true);
    expect(result.lineItems.some((i) => i.id === "hosting_soc2")).toBe(false);
  });

  it("CJIS compliance forces FedRAMP hosting", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ hostingModel: "soc2", compliance: ["cjis"] }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "hosting_fedramp")).toBe(true);
  });

  it("scales hosting with environment count", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ environmentCount: 5 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.find((i) => i.id === "hosting_soc2")?.subtotal).toBe(
      10_125,
    );
  });
});

describe("portals", () => {
  it("B2C portal adds the pack matching MAU", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ includeB2c: true, b2cMau: 25_000 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.find((i) => i.id === "b2c_pack3")?.subtotal).toBe(
      4167,
    );
  });

  it("skips the B2C pack when the portal is off", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ includeB2c: false, b2cMau: 25_000 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id.startsWith("b2c_"))).toBe(false);
  });

  it("B2B users add $15 per user monthly", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ includeB2bPortal: true, b2bUserCount: 200 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.find((i) => i.id === "b2b_user")?.subtotal).toBe(
      3000,
    );
  });

  it("skips B2B users when the portal is off", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ includeB2bPortal: false, b2bUserCount: 200 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "b2b_user")).toBe(false);
  });
});

describe("case worker tier boundaries", () => {
  it("500 case workers stay on tier 1", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ caseWorkerCount: 500 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.find((i) => i.id === "cw_tier1")?.subtotal).toBeCloseTo(
      48_950,
      2,
    );
  });

  it("501 case workers move to tier 2", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ caseWorkerCount: 501 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "cw_tier2")).toBe(true);
  });

  it("1,200 case workers move to tier 3", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ caseWorkerCount: 1200 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "cw_tier3")).toBe(true);
  });

  it("no case workers adds no licensing line item", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ caseWorkerCount: 0 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id.startsWith("cw_"))).toBe(false);
  });
});

describe("support tier auto-selection", () => {
  it("auto-selects standard support for 100 case workers", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ supportTier: null, caseWorkerCount: 100 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "support_standard")).toBe(true);
  });

  it("auto-selects enhanced support for 250 case workers", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ supportTier: null, caseWorkerCount: 250 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "support_enhanced")).toBe(true);
  });

  it("auto-selects premium support for 800 case workers", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ supportTier: null, caseWorkerCount: 800 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "support_premium")).toBe(true);
  });

  it("respects an explicit support tier over the recommendation", () => {
    const result = calculatePricingBreakdown(
      makeQuote({ supportTier: "standard", caseWorkerCount: 800 }),
      TEST_CATALOG,
    );
    expect(result.lineItems.some((i) => i.id === "support_standard")).toBe(true);
  });
});
