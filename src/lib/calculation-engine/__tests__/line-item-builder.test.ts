import { describe, expect, it } from "vitest";
import { calculatePricingBreakdown } from "../baseline-calculator";
import { findSku, findTieredSku, toLineItem } from "../catalog-utils";
import { TEST_CATALOG, makeQuote } from "../__test-fixtures__/catalog";

const FULL_QUOTE = makeQuote({
  includeB2c: true,
  b2cMau: 25_000,
  includeB2bPortal: true,
  b2bUserCount: 200,
});

describe("line item shape", () => {
  const { lineItems } = calculatePricingBreakdown(FULL_QUOTE, TEST_CATALOG);

  it("emits at least one line item for a fully configured quote", () => {
    expect(lineItems.length).toBeGreaterThan(0);
  });

  it.each(["id", "label", "category", "unitPrice", "quantity", "subtotal"])(
    "every line item defines %s",
    (key) => {
      for (const item of lineItems) {
        expect(item[key as keyof typeof item]).not.toBeUndefined();
      }
    },
  );

  it("uses only known categories", () => {
    for (const item of lineItems) {
      expect(["one_time", "monthly"]).toContain(item.category);
    }
  });

  it("keeps subtotal equal to unitPrice * quantity", () => {
    for (const item of lineItems) {
      expect(item.subtotal).toBeCloseTo(item.unitPrice * item.quantity, 6);
    }
  });

  it("never emits zero or negative quantities", () => {
    for (const item of lineItems) {
      expect(item.quantity).toBeGreaterThan(0);
    }
  });

  it("uses unique ids", () => {
    const ids = lineItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("total invariants", () => {
  const result = calculatePricingBreakdown(FULL_QUOTE, TEST_CATALOG);

  it("one-time subtotals sum to oneTimeTotal", () => {
    const sum = result.lineItems
      .filter((i) => i.category === "one_time")
      .reduce((a, i) => a + i.subtotal, 0);
    expect(sum).toBeCloseTo(result.oneTimeTotal, 6);
  });

  it("monthly subtotals sum to monthlyRecurring", () => {
    const sum = result.lineItems
      .filter((i) => i.category === "monthly")
      .reduce((a, i) => a + i.subtotal, 0);
    expect(sum).toBeCloseTo(result.monthlyRecurring, 6);
  });

  it("annualRecurring is exactly 12x monthly", () => {
    expect(result.annualRecurring).toBeCloseTo(result.monthlyRecurring * 12, 6);
  });

  it("baselineTCV equals one-time plus annual times years", () => {
    expect(result.baselineTCV).toBeCloseTo(
      result.oneTimeTotal + result.annualRecurring * result.contractYears,
      6,
    );
  });

  it("adjustedBaseline equals baseline plus the adjustment", () => {
    expect(result.adjustedBaseline).toBeCloseTo(
      result.baselineTCV + result.repeatableActivationAdjustment,
      6,
    );
  });

  it("finalTCV is at least the adjusted baseline", () => {
    expect(result.finalTCV).toBeGreaterThanOrEqual(result.adjustedBaseline);
  });
});

describe("empty configuration", () => {
  const result = calculatePricingBreakdown(
    makeQuote({
      moduleTier: null,
      caseWorkerCount: 0,
      hostingModel: "customer_hosted",
      supportTier: null,
      includeB2c: false,
      includeB2bPortal: false,
    }),
    TEST_CATALOG,
  );

  it("returns an array rather than null", () => {
    expect(Array.isArray(result.lineItems)).toBe(true);
  });

  it("only carries the auto-selected support line", () => {
    expect(result.lineItems.map((i) => i.id)).toEqual(["support_standard"]);
  });

  it("has a zero one-time total", () => {
    expect(result.oneTimeTotal).toBe(0);
  });
});

describe("catalog utilities", () => {
  it("finds an exact SKU", () => {
    expect(findSku(TEST_CATALOG, "b2b_user")?.unit_price).toBe(15);
  });

  it("returns null for an unknown SKU", () => {
    expect(findSku(TEST_CATALOG, "nope")).toBeNull();
  });

  it("matches the tier band containing the value", () => {
    expect(findTieredSku(TEST_CATALOG, "cw_", 700)?.sku_id).toBe("cw_tier2");
  });

  it("falls back to the highest band above the top tier", () => {
    expect(findTieredSku(TEST_CATALOG, "cw_", 99_999)?.sku_id).toBe("cw_tier3");
  });

  it("returns null when no tiered SKU matches the prefix", () => {
    expect(findTieredSku(TEST_CATALOG, "zzz_", 10)).toBeNull();
  });

  it("returns null for a non-positive quantity", () => {
    expect(toLineItem(TEST_CATALOG[0]!, 0)).toBeNull();
    expect(toLineItem(TEST_CATALOG[0]!, -3)).toBeNull();
  });

  it("omits notes when none are supplied", () => {
    expect(toLineItem(TEST_CATALOG[0]!, 1)).not.toHaveProperty("notes");
  });
});
