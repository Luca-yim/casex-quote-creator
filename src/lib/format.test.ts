import { describe, expect, it } from "vitest";
import { cn, formatCurrency, formatNumber } from "./utils";

describe("formatCurrency", () => {
  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats a small amount", () => {
    expect(formatCurrency(1234)).toBe("$1,234");
  });

  it("formats a large amount", () => {
    expect(formatCurrency(1_666_140)).toBe("$1,666,140");
  });

  it("formats a negative amount", () => {
    expect(formatCurrency(-2500)).toBe("-$2,500");
  });

  it("rounds to whole dollars by default", () => {
    expect(formatCurrency(1234.56)).toBe("$1,235");
  });

  it("honours an explicit decimal count", () => {
    expect(formatCurrency(1234.5, { decimals: 2 })).toBe("$1,234.50");
  });

  it("compacts thousands", () => {
    expect(formatCurrency(25_865, { compact: true })).toBe("$25.9K");
  });

  it("compacts millions", () => {
    expect(formatCurrency(2_082_675, { compact: true })).toBe("$2.1M");
  });

  it("drops a trailing .0 when compacting", () => {
    expect(formatCurrency(2_000_000, { compact: true })).toBe("$2M");
  });

  it("does not compact below one thousand", () => {
    expect(formatCurrency(999, { compact: true })).toBe("$999");
  });

  it("compacts negative millions", () => {
    expect(formatCurrency(-1_500_000, { compact: true })).toBe("$-1.5M");
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("rounds to zero decimals by default", () => {
    expect(formatNumber(97.9)).toBe("98");
  });

  it("honours a decimal count", () => {
    expect(formatNumber(97.9, 2)).toBe("97.90");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats negatives", () => {
    expect(formatNumber(-4200)).toBe("-4,200");
  });
});

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsey values", () => {
    expect(cn("flex", false && "hidden", undefined)).toBe("flex");
  });
});
