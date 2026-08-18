import { describe, expect, it } from "vitest";
import { deriveTimeline } from "./timeline-helper";

const TODAY = new Date("2026-01-15T00:00:00.000Z");

describe("deriveTimeline", () => {
  it("3 months out is aggressive", () => {
    const r = deriveTimeline("2026-04-15", TODAY);
    expect(r.tier).toBe("aggressive");
    expect(r.monthsRemaining).toBe(3);
  });

  it("7 months out is standard", () => {
    expect(deriveTimeline("2026-08-15", TODAY).tier).toBe("standard");
  });

  it("12 months out is comfortable", () => {
    const r = deriveTimeline("2027-01-15", TODAY);
    expect(r.tier).toBe("comfortable");
    expect(r.monthsRemaining).toBe(12);
  });

  it("a null target date yields a null tier", () => {
    const r = deriveTimeline(null, TODAY);
    expect(r.tier).toBeNull();
    expect(r.monthsRemaining).toBeNull();
    expect(r.displayLabel).toMatch(/No target go-live date/);
  });

  it("a past date clamps to 0 months and is aggressive", () => {
    const r = deriveTimeline("2025-10-15", TODAY);
    expect(r.monthsRemaining).toBe(0);
    expect(r.tier).toBe("aggressive");
  });

  describe("boundaries", () => {
    it("5 months out is aggressive", () => {
      expect(deriveTimeline("2026-06-15", TODAY).tier).toBe("aggressive");
    });

    it("6 months out is standard", () => {
      expect(deriveTimeline("2026-07-15", TODAY).tier).toBe("standard");
    });

    it("9 months out is standard", () => {
      expect(deriveTimeline("2026-10-15", TODAY).tier).toBe("standard");
    });

    it("10 months out is comfortable", () => {
      expect(deriveTimeline("2026-11-15", TODAY).tier).toBe("comfortable");
    });
  });

  it("is deterministic for an injected today", () => {
    expect(deriveTimeline("2026-08-15", TODAY)).toEqual(
      deriveTimeline("2026-08-15", TODAY),
    );
  });

  it("renders a human-readable label", () => {
    expect(deriveTimeline("2026-04-15", TODAY).displayLabel).toBe(
      "3 months out — Aggressive timeline",
    );
  });
});
