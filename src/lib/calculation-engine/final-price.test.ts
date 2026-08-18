import { describe, expect, it } from "vitest";
import {
  applyMargin,
  applyRepeatableActivationAdjustment,
} from "./final-price";

describe("applyRepeatableActivationAdjustment", () => {
  it("full_match on a $1M baseline = -$100K", () => {
    expect(applyRepeatableActivationAdjustment(1_000_000, "full_match")).toBe(
      -100_000,
    );
  });

  it("partial_match on a $1M baseline = -$50K", () => {
    expect(applyRepeatableActivationAdjustment(1_000_000, "partial_match")).toBe(
      -50_000,
    );
  });

  it("novel on a $1M baseline = $0", () => {
    expect(applyRepeatableActivationAdjustment(1_000_000, "novel")).toBe(0);
  });

  it("returns 0 for a zero baseline regardless of match", () => {
    expect(applyRepeatableActivationAdjustment(0, "full_match")).toBe(0);
  });
});

describe("applyMargin", () => {
  it("$800K at 20% margin = $1,000,000", () => {
    expect(applyMargin(800_000, 20)).toBeCloseTo(1_000_000, 2);
  });

  it("$850K at 15% margin = $1,000,000", () => {
    expect(applyMargin(850_000, 15)).toBeCloseTo(1_000_000, 2);
  });

  it("$700K at 30% margin = $1,000,000", () => {
    expect(applyMargin(700_000, 30)).toBeCloseTo(1_000_000, 2);
  });

  it("accepts the 10% lower bound", () => {
    expect(applyMargin(900_000, 10)).toBeCloseTo(1_000_000, 2);
  });

  it("throws when margin is below 10", () => {
    expect(() => applyMargin(1_000, 9)).toThrow(/between 10% and 30%/);
  });

  it("throws when margin is above 30", () => {
    expect(() => applyMargin(1_000, 31)).toThrow(/between 10% and 30%/);
  });
});
