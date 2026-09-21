import { describe, expect, it } from "vitest";
import {
  computeProposalTotals,
  normalizeContractYears,
  DEFAULT_CONTRACT_YEARS,
} from "../proposalTotal";

const catalog = {
  oneTimeTotal: 100_000,
  monthlyRecurring: 10_000,
  contractYears: 3,
  naspoDiscountApplied: false,
};

describe("normalizeContractYears", () => {
  it("clamps to 1..10 and rounds to whole years", () => {
    expect(normalizeContractYears(0)).toBe(1);
    expect(normalizeContractYears(11)).toBe(10);
    expect(normalizeContractYears(3.4)).toBe(3);
    expect(normalizeContractYears(Number.NaN)).toBe(DEFAULT_CONTRACT_YEARS);
  });
});

describe("computeProposalTotals", () => {
  it("composes one-time, annual, multi-year and combined totals", () => {
    const t = computeProposalTotals(500_000, catalog);
    expect(t.oneTimeSubtotal).toBe(600_000);
    expect(t.annualRecurring).toBe(120_000);
    expect(t.multiYearRecurring).toBe(360_000);
    expect(t.proposalTotal).toBe(960_000);
  });

  it("applies margin only once — the fee passes through untouched", () => {
    const t = computeProposalTotals(500_000, catalog);
    expect(t.implementationFee).toBe(500_000);
    expect(t.proposalTotal - t.multiYearRecurring - t.catalogOneTime).toBe(500_000);
  });

  it("scales only the recurring side with duration", () => {
    const one = computeProposalTotals(500_000, { ...catalog, contractYears: 1 });
    const ten = computeProposalTotals(500_000, { ...catalog, contractYears: 10 });
    expect(one.multiYearRecurring).toBe(120_000);
    expect(ten.multiYearRecurring).toBe(1_200_000);
    expect(ten.oneTimeSubtotal).toBe(one.oneTimeSubtotal);
  });

  it("handles a quote with no recurring items", () => {
    const t = computeProposalTotals(500_000, { ...catalog, monthlyRecurring: 0 });
    expect(t.annualRecurring).toBe(0);
    expect(t.proposalTotal).toBe(600_000);
  });

  it("carries the NASPO flag through", () => {
    const t = computeProposalTotals(1, { ...catalog, naspoDiscountApplied: true });
    expect(t.naspoDiscountApplied).toBe(true);
  });

  it("falls back to 0 for a non-finite implementation fee", () => {
    const t = computeProposalTotals(Number.POSITIVE_INFINITY, catalog);
    expect(t.implementationFee).toBe(0);
    expect(Number.isFinite(t.proposalTotal)).toBe(true);
  });
});
