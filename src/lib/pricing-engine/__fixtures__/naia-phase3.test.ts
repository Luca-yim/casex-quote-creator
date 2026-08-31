import { describe, expect, it } from "vitest";
import {
  grandTotalCost,
  marginScenarios,
  totalImplementationFee,
  type CostItem,
  type WbsLine,
} from "../fullQuote";

/** NAIA Phase 3 regression fixture: 22,880 cost hours, $828,800 cost. */
const HOURS = 22_880;

const lines: WbsLine[] = [
  { costHours: HOURS, costRate: 35, revenueHours: HOURS, billRate: 55 },
];
const items: CostItem[] = [{ amount: 28_000 }];

describe("NAIA Phase 3", () => {
  it("reproduces the grand total cost", () => {
    expect(grandTotalCost(lines, items)).toBeCloseTo(828_800, 2);
  });

  it("reproduces the reference margin scenarios", () => {
    const cost = grandTotalCost(lines, items);
    const scenarios = marginScenarios(cost, HOURS);

    const at25 = scenarios.find((s) => s.margin === 0.25)!;
    expect(at25.revenue).toBeCloseTo(1_105_066.67, 0);
    expect(at25.blendedRate).toBeCloseTo(48.3, 1);

    const at35 = scenarios.find((s) => s.margin === 0.35)!;
    expect(at35.revenue).toBeCloseTo(1_275_076.92, 0);
    expect(at35.blendedRate).toBeCloseTo(55.73, 1);
  });

  it("reproduces the binding implementation fee at 35% + 5% contingency", () => {
    const cost = grandTotalCost(lines, items);
    expect(totalImplementationFee(35, cost, 0.05)).toBeCloseTo(1_338_830.77, 0);
  });
});
