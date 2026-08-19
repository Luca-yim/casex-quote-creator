import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dotClassForType,
  notificationTarget,
  relativeTime,
} from "../notification-ui";

describe("notificationTarget", () => {
  it("routes estimators to the review detail page", () => {
    expect(notificationTarget("estimator", "q1")).toEqual({
      to: "/review/$id",
      params: { id: "q1" },
    });
  });

  it("routes admins to the review detail page", () => {
    expect(notificationTarget("admin", "q1").to).toBe("/review/$id");
  });

  it("routes sales reps to the rep quote page", () => {
    expect(notificationTarget("sales_rep", "q1").to).toBe("/quotes/$id");
  });

  it("routes external users to the request page", () => {
    expect(notificationTarget("external", "q1").to).toBe("/request-quote/$id");
  });

  it("defaults an unknown role to the external route", () => {
    expect(notificationTarget(null, "q1").to).toBe("/request-quote/$id");
  });
});

describe("dotClassForType", () => {
  it.each([
    ["quote_submitted", "bg-blue-500"],
    ["quote_approved", "bg-emerald-500"],
    ["quote_returned", "bg-amber-500"],
    ["quote_sent", "bg-purple-500"],
  ])("maps %s to %s", (type, expected) => {
    expect(dotClassForType(type)).toBe(expected);
  });

  it("falls back for unknown types", () => {
    expect(dotClassForType("something_else")).toBe("bg-muted-foreground");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");
  const iso = (secondsAgo: number) =>
    new Date(now.getTime() - secondsAgo * 1000).toISOString();

  afterEach(() => vi.useRealTimers());

  function withFrozenClock<T>(fn: () => T): T {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    return fn();
  }

  it("formats seconds", () => {
    expect(withFrozenClock(() => relativeTime(iso(30)))).toBe("30s ago");
  });

  it("formats minutes", () => {
    expect(withFrozenClock(() => relativeTime(iso(300)))).toBe("5m ago");
  });

  it("formats hours", () => {
    expect(withFrozenClock(() => relativeTime(iso(7200)))).toBe("2h ago");
  });

  it("formats days", () => {
    expect(withFrozenClock(() => relativeTime(iso(3 * 86_400)))).toBe("3d ago");
  });

  it("falls back to a date beyond 30 days", () => {
    expect(withFrozenClock(() => relativeTime(iso(90 * 86_400)))).toMatch(
      /\d{1,2}\/\d{1,2}\/\d{4}/,
    );
  });

  it("returns an empty string for an invalid date", () => {
    expect(relativeTime("nope")).toBe("");
  });
});
