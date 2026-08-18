import { describe, expect, it } from "vitest";
import { calculateContractTCV } from "./contract-tcv";

describe("calculateContractTCV", () => {
  it("$1M one-time + $10K/mo over 3 years = $1,360,000", () => {
    expect(calculateContractTCV(1_000_000, 10_000, 3)).toBe(1_360_000);
  });

  it("$0 one-time + $5K/mo over 5 years = $300,000", () => {
    expect(calculateContractTCV(0, 5_000, 5)).toBe(300_000);
  });

  it("$500K one-time + $0/mo over 3 years = $500,000", () => {
    expect(calculateContractTCV(500_000, 0, 3)).toBe(500_000);
  });

  it("returns 0 when everything is 0", () => {
    expect(calculateContractTCV(0, 0, 3)).toBe(0);
  });

  it("scales linearly with contract years", () => {
    expect(calculateContractTCV(0, 1_000, 1)).toBe(12_000);
    expect(calculateContractTCV(0, 1_000, 2)).toBe(24_000);
  });
});
