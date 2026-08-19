import { describe, expect, it } from "vitest";
import {
  cn,
  formatCurrency,
  formatFileSize,
  formatNumber,
  formatRelativeTime,
} from "./utils";

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

  it("compacts negative millions with the sign before the symbol", () => {
    expect(formatCurrency(-1_500_000, { compact: true })).toBe("-$1.5M");
  });

  it("compacts negative thousands with the sign before the symbol", () => {
    expect(formatCurrency(-25_865, { compact: true })).toBe("-$25.9K");
  });

  it("renders an em dash for null", () => {
    expect(formatCurrency(null)).toBe("—");
  });

  it("renders an em dash for undefined", () => {
    expect(formatCurrency(undefined)).toBe("—");
  });

  it("renders an em dash for NaN", () => {
    expect(formatCurrency(Number.NaN)).toBe("—");
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

describe("formatFileSize", () => {
  it("formats zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats raw bytes below 1 KB", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats the 1 KB boundary", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
  });

  it("formats kilobytes with one decimal", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(2.5 * 1024 ** 3)).toBe("2.5 GB");
  });

  it("caps at terabytes", () => {
    expect(formatFileSize(3 * 1024 ** 4)).toBe("3 TB");
  });

  it("honours an explicit decimal count", () => {
    expect(formatFileSize(1_234_567, 2)).toBe("1.18 MB");
  });

  it("renders an em dash for null, undefined and negatives", () => {
    expect(formatFileSize(null)).toBe("—");
    expect(formatFileSize(undefined)).toBe("—");
    expect(formatFileSize(-1)).toBe("—");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

  it("treats the last 45 seconds as just now", () => {
    expect(formatRelativeTime(ago(10), now)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(formatRelativeTime(ago(5 * 60), now)).toBe("5 minutes ago");
  });

  it("singularises one minute", () => {
    expect(formatRelativeTime(ago(60), now)).toBe("1 minute ago");
  });

  it("formats hours", () => {
    expect(formatRelativeTime(ago(3 * 3600), now)).toBe("3 hours ago");
  });

  it("formats days", () => {
    expect(formatRelativeTime(ago(3 * 86_400), now)).toBe("3 days ago");
  });

  it("formats months", () => {
    expect(formatRelativeTime(ago(60 * 86_400), now)).toBe("2 months ago");
  });

  it("formats years", () => {
    expect(formatRelativeTime(ago(800 * 86_400), now)).toBe("2 years ago");
  });

  it("accepts an ISO string", () => {
    expect(formatRelativeTime("2026-08-19T09:00:00.000Z", now)).toBe("3 hours ago");
  });

  it("accepts epoch milliseconds", () => {
    expect(formatRelativeTime(ago(120).getTime(), now)).toBe("2 minutes ago");
  });

  it("clamps future timestamps to just now", () => {
    expect(formatRelativeTime(new Date(now.getTime() + 60_000), now)).toBe(
      "just now",
    );
  });

  it("renders an em dash for null and invalid dates", () => {
    expect(formatRelativeTime(null)).toBe("—");
    expect(formatRelativeTime("not a date")).toBe("—");
  });
});
