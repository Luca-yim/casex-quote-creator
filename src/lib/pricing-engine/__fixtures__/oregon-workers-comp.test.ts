import { describe, expect, it } from "vitest";
import {
  grandTotalCost,
  totalImplementationFee,
  type WbsLine,
} from "../fullQuote";

/**
 * Oregon Workers' Comp regression fixture: 61,695 hours, 10% contingency,
 * $4,948,240 Total Implementation Fee at a 35% margin.
 */
const HOURS = 61_695;
const COST_RATE = 47.39379204149445;

const lines: WbsLine[] = [
  { costHours: HOURS, costRate: COST_RATE, revenueHours: HOURS, billRate: 82 },
];

describe("Oregon Workers' Comp", () => {
  it("reproduces the grand total cost basis", () => {
    expect(grandTotalCost(lines, [])).toBeCloseTo(2_923_960, 2);
  });

  it("reproduces the total implementation fee at 10% contingency", () => {
    const cost = grandTotalCost(lines, []);
    expect(totalImplementationFee(35, cost, 0.1)).toBeCloseTo(4_948_240, 0);
  });
});
