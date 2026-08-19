import { describe, expect, it } from "vitest";
import {
  CHECK_VIOLATION,
  RLS_VIOLATION,
  describeQuoteWriteError,
  isPermissionError,
} from "./supabase-errors";

describe("isPermissionError", () => {
  it("detects the RLS error code", () => {
    expect(isPermissionError({ code: RLS_VIOLATION })).toBe(true);
  });

  it("detects the RLS message text", () => {
    expect(
      isPermissionError({ message: 'new row violates row-level security policy' }),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isPermissionError({ code: "23505", message: "duplicate key" })).toBe(
      false,
    );
  });

  it("handles null and undefined", () => {
    expect(isPermissionError(null)).toBe(false);
    expect(isPermissionError(undefined)).toBe(false);
  });
});

describe("describeQuoteWriteError", () => {
  it("explains a permission failure and names the target state", () => {
    const msg = describeQuoteWriteError({ code: RLS_VIOLATION }, "approved");
    expect(msg).toMatch(/isn't allowed/i);
    expect(msg).toContain("Approved");
  });

  it("omits the state name when none is supplied", () => {
    const msg = describeQuoteWriteError({ code: RLS_VIOLATION });
    expect(msg).not.toContain("“");
  });

  it("explains a state-machine check violation", () => {
    const msg = describeQuoteWriteError({ code: CHECK_VIOLATION }, "draft");
    expect(msg).toMatch(/state-machine guard/i);
    expect(msg).toContain("Draft");
  });

  it("detects the guard by message when the code is missing", () => {
    const msg = describeQuoteWriteError({
      message: "Invalid state transition: draft → approved",
    });
    expect(msg).toMatch(/state-machine guard/i);
  });

  it("passes through a plain Error message", () => {
    expect(describeQuoteWriteError(new Error("network down"))).toBe("network down");
  });

  it("falls back to a generic retry message", () => {
    expect(describeQuoteWriteError({})).toBe("Please try again.");
    expect(describeQuoteWriteError(null)).toBe("Please try again.");
  });
});
