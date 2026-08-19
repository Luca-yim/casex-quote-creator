import { describe, expect, it } from "vitest";
import { computeShowPricing } from "../IntakeContext";
import { STATE_LABELS } from "@/lib/quote-workflow";
import type { QuoteState } from "@/types/quote";

const STATES = Object.keys(STATE_LABELS) as QuoteState[];

describe("computeShowPricing — external", () => {
  it.each(STATES)("never shows pricing in state %s", (state) => {
    expect(computeShowPricing("external", state)).toBe(false);
  });
});

describe("computeShowPricing — estimator and admin", () => {
  it.each(STATES)("estimator sees pricing in state %s", (state) => {
    expect(computeShowPricing("estimator", state)).toBe(true);
  });

  it.each(STATES)("admin sees pricing in state %s", (state) => {
    expect(computeShowPricing("admin", state)).toBe(true);
  });
});

describe("computeShowPricing — sales rep", () => {
  it.each(["draft", "submitted_for_review", "under_review", "estimator_adjusted"] as QuoteState[])(
    "hides pricing before approval (%s)",
    (state) => {
      expect(computeShowPricing("sales_rep", state)).toBe(false);
    },
  );

  it.each(["approved", "sent_to_customer", "accepted", "declined"] as QuoteState[])(
    "shows pricing from approval onwards (%s)",
    (state) => {
      expect(computeShowPricing("sales_rep", state)).toBe(true);
    },
  );

  it("hides pricing for archived quotes", () => {
    expect(computeShowPricing("sales_rep", "archived")).toBe(false);
  });
});
