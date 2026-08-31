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
    expect(applyRepeatableActivationAdjustment(0, "full_match")).toBeCloseTo(0);
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

  it("accepts a low out-of-legacy-band margin (full estimator discretion)", () => {
    expect(applyMargin(900_000, 10)).toBeCloseTo(1_000_000, 2);
    expect(applyMargin(1_000, 5)).toBeCloseTo(1_052.6315, 2);
  });

  it("accepts a high out-of-legacy-band margin", () => {
    expect(applyMargin(1_000, 45)).toBeCloseTo(1_818.1818, 2);
  });

  it("throws when margin is negative", () => {
    expect(() => applyMargin(1_000, -1)).toThrow(/between 0% and 100%/);
  });

  it("throws at 100% margin (undefined price)", () => {
    expect(() => applyMargin(1_000, 100)).toThrow(/between 0% and 100%/);
  });
});
