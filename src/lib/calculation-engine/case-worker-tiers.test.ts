import { describe, expect, it } from "vitest";
import {
  calculateCaseWorkerLineItem,
  selectCaseWorkerTier,
} from "./case-worker-tiers";
import { TEST_CATALOG } from "./__test-fixtures__/catalog";

describe("selectCaseWorkerTier", () => {
  it("returns tier1 for 100 users", () => {
    expect(selectCaseWorkerTier(100, TEST_CATALOG)?.sku_id).toBe("cw_tier1");
  });

  it("returns tier2 for 750 users", () => {
    expect(selectCaseWorkerTier(750, TEST_CATALOG)?.sku_id).toBe("cw_tier2");
  });

  it("returns tier3 for 1200 users", () => {
    expect(selectCaseWorkerTier(1200, TEST_CATALOG)?.sku_id).toBe("cw_tier3");
  });

  it("returns null for 0 users", () => {
    expect(selectCaseWorkerTier(0, TEST_CATALOG)).toBeNull();
  });

  it("returns tier3 for 1500 users (upper boundary)", () => {
    expect(selectCaseWorkerTier(1500, TEST_CATALOG)?.sku_id).toBe("cw_tier3");
  });

  it("returns tier1 at the 500 boundary", () => {
    expect(selectCaseWorkerTier(500, TEST_CATALOG)?.sku_id).toBe("cw_tier1");
  });

  it("returns tier2 at the 501 boundary", () => {
    expect(selectCaseWorkerTier(501, TEST_CATALOG)?.sku_id).toBe("cw_tier2");
  });

  it("returns tier2 at the 1000 boundary", () => {
    expect(selectCaseWorkerTier(1000, TEST_CATALOG)?.sku_id).toBe("cw_tier2");
  });

  it("returns tier3 at the 1001 boundary", () => {
    expect(selectCaseWorkerTier(1001, TEST_CATALOG)?.sku_id).toBe("cw_tier3");
  });

  it("falls back to tier3 above the top band", () => {
    expect(selectCaseWorkerTier(5000, TEST_CATALOG)?.sku_id).toBe("cw_tier3");
  });
});

describe("calculateCaseWorkerLineItem", () => {
  it("prices 100 users at $97.90 = $9,790 monthly", () => {
    const item = calculateCaseWorkerLineItem(100, TEST_CATALOG);
    expect(item?.subtotal).toBeCloseTo(9790, 2);
    expect(item?.category).toBe("monthly");
  });

  it("prices 500 users at $97.90 = $48,950", () => {
    expect(calculateCaseWorkerLineItem(500, TEST_CATALOG)?.subtotal).toBeCloseTo(
      48950,
      2,
    );
  });

  it("prices 501 users at $83.60 = $41,883.60", () => {
    const item = calculateCaseWorkerLineItem(501, TEST_CATALOG);
    expect(item?.unitPrice).toBe(83.6);
    expect(item?.subtotal).toBeCloseTo(501 * 83.6, 2);
  });

  it("returns null when userCount is 0", () => {
    expect(calculateCaseWorkerLineItem(0, TEST_CATALOG)).toBeNull();
  });

  it("carries the tier sku id and quantity", () => {
    const item = calculateCaseWorkerLineItem(1200, TEST_CATALOG);
    expect(item?.id).toBe("cw_tier3");
    expect(item?.quantity).toBe(1200);
  });

  it("returns null when the catalog has no tiers", () => {
    expect(calculateCaseWorkerLineItem(100, [])).toBeNull();
  });
});
