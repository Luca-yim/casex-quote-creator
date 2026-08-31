import { describe, expect, it } from "vitest";
import { readinessCheck, validateQuoteForSubmission } from "./quote-validation";
import {
  makeEmptyQuote,
  makeQuote,
} from "./calculation-engine/__test-fixtures__/catalog";

describe("validateQuoteForSubmission", () => {
  it("returns valid: true for a complete quote", () => {
    const result = validateQuoteForSubmission(makeQuote());
    expect(result.valid).toBe(true);
    expect(result.missingRequiredFields).toEqual([]);
    expect(result.errors).toEqual({});
  });

  it("returns valid: false for an empty draft", () => {
    expect(validateQuoteForSubmission(makeEmptyQuote()).valid).toBe(false);
  });

  it("lists missing required fields for an empty draft", () => {
    const result = validateQuoteForSubmission(makeEmptyQuote());
    expect(result.missingRequiredFields).toEqual(
      expect.arrayContaining([
        "customerName",
        "customerType",
        "vertical",
        "solution",
        "moduleTier",
        "hostingModel",
        "supportTier",
      ]),
    );
  });

  it("keys errors by field path", () => {
    const result = validateQuoteForSubmission(makeQuote({ customerName: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors["customerName"]).toBeTruthy();
  });

  it("rejects a margin outside 0-100", () => {
    expect(validateQuoteForSubmission(makeQuote({ marginPercent: 101 })).valid).toBe(
      false,
    );
    expect(validateQuoteForSubmission(makeQuote({ marginPercent: -1 })).valid).toBe(
      false,
    );
  });

  it("accepts any margin 0-100 (full estimator discretion)", () => {
    for (const m of [0, 10, 30, 45, 100]) {
      expect(validateQuoteForSubmission(makeQuote({ marginPercent: m })).valid).toBe(
        true,
      );
    }
  });
});

describe("readinessCheck", () => {
  it("reports 0 of N for an empty draft", () => {
    const result = readinessCheck(makeEmptyQuote());
    expect(result.completedCount).toBe(0);
    expect(result.ready).toBe(false);
    expect(result.missing).toHaveLength(result.totalRequired);
  });

  it("reports N of N for a complete quote", () => {
    const result = readinessCheck(makeQuote());
    expect(result.completedCount).toBe(result.totalRequired);
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("counts partial completion", () => {
    const result = readinessCheck(
      makeEmptyQuote({ customerName: "Acme County", vertical: "HHS" }),
    );
    expect(result.completedCount).toBe(2);
    expect(result.ready).toBe(false);
  });

  it("treats whitespace-only strings as missing", () => {
    expect(readinessCheck(makeQuote({ customerName: "   " })).missing).toContain(
      "customerName",
    );
  });

  it("tracks eight required fields", () => {
    expect(readinessCheck(makeQuote()).totalRequired).toBe(8);
  });
});
