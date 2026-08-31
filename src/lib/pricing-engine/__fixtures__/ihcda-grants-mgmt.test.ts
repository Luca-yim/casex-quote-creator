import { describe, expect, it } from "vitest";
import {
  grandTotalCost,
  totalImplementationFee,
  type WbsLine,
} from "../fullQuote";

/**
 * IHCDA Grants Management regression fixture: 33,124 hours at a blended
 * cost rate producing the $2,552,426.52 Total Implementation Fee at a
 * 38% realized margin with 3% contingency.
 */
const HOURS = 33_124;
const COST_RATE = 46.383651732882505;

const lines: WbsLine[] = [
  { costHours: HOURS, costRate: COST_RATE, revenueHours: HOURS, billRate: 78 },
];

describe("IHCDA Grants Management", () => {
  it("reproduces the grand total cost basis", () => {
    expect(grandTotalCost(lines, [])).toBeCloseTo(1_536_412.08, 2);
  });

  it("reproduces the total implementation fee at 38% margin, 3% contingency", () => {
    const cost = grandTotalCost(lines, []);
    expect(totalImplementationFee(38, cost, 0.03)).toBeCloseTo(2_552_426.52, 0);
  });
});
