import { describe, expect, it } from "vitest";
import {
  calculateSupportLineItem,
  recommendSupportTier,
} from "./support-tier-selection";
import { TEST_CATALOG } from "./__test-fixtures__/catalog";

describe("recommendSupportTier", () => {
  it("recommends standard for 50 users", () => {
    expect(recommendSupportTier(50)).toBe("standard");
  });

  it("recommends standard at 100 users (boundary)", () => {
    expect(recommendSupportTier(100)).toBe("standard");
  });

  it("recommends enhanced at 101 users", () => {
    expect(recommendSupportTier(101)).toBe("enhanced");
  });

  it("recommends enhanced at 300 users (boundary)", () => {
    expect(recommendSupportTier(300)).toBe("enhanced");
  });

  it("recommends premium at 301 users", () => {
    expect(recommendSupportTier(301)).toBe("premium");
  });

  it("recommends premium at 1,000 users", () => {
    expect(recommendSupportTier(1000)).toBe("premium");
  });

  it("recommends standard for 0 users", () => {
    expect(recommendSupportTier(0)).toBe("standard");
  });
});

describe("calculateSupportLineItem", () => {
  it("prices standard support at $10,000 monthly", () => {
    const item = calculateSupportLineItem("standard", TEST_CATALOG);
    expect(item?.subtotal).toBe(10000);
    expect(item?.category).toBe("monthly");
  });

  it("prices enhanced support at $17,000 monthly", () => {
    expect(calculateSupportLineItem("enhanced", TEST_CATALOG)?.subtotal).toBe(
      17000,
    );
  });

  it("prices premium support at $45,000 monthly", () => {
    expect(calculateSupportLineItem("premium", TEST_CATALOG)?.subtotal).toBe(
      45000,
    );
  });

  it("uses quantity 1 (flat fee)", () => {
    expect(calculateSupportLineItem("standard", TEST_CATALOG)?.quantity).toBe(1);
  });

  it("returns null when the catalog lacks the SKU", () => {
    expect(calculateSupportLineItem("premium", [])).toBeNull();
  });
});
