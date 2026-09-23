import { describe, expect, it } from "vitest";
import { calculatePricingBreakdown } from "@/lib/calculation-engine/baseline-calculator";
import { TEST_CATALOG, makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { mapQuoteToDrivers } from "@/lib/pricing-engine/mapQuoteToDrivers";
import { buildAssumptions } from "@/lib/assumptions-builder";
import { quoteSchema, type Quote } from "@/types/quote";
import { rowToQuote, QUOTE_FIELD_COLUMNS } from "../quote-mapper";

const NULLS = {
  caseWorkerStudioUsers: null,
  expectedUserGrowth: null,
  expectedUserGrowthOtherDetail: null,
  peakLoadMultiplier: null,
  peakLoadMultiplierOtherDetail: null,
  b2bOrgCount: null,
  b2bAvgUsersPerOrg: null,
} satisfies Partial<Quote>;

const POPULATED = {
  caseWorkerStudioUsers: 8,
  expectedUserGrowth: "other",
  expectedUserGrowthOtherDetail: "Doubling after year 2",
  peakLoadMultiplier: "other",
  peakLoadMultiplierOtherDetail: "Open enrollment spikes",
  b2bOrgCount: 100,
  b2bAvgUsersPerOrg: 3,
} satisfies Partial<Quote>;

const SECTION4_COLUMNS = {
  caseWorkerStudioUsers: "case_worker_studio_users",
  expectedUserGrowth: "expected_user_growth",
  expectedUserGrowthOtherDetail: "expected_user_growth_other_detail",
  peakLoadMultiplier: "peak_load_multiplier",
  peakLoadMultiplierOtherDetail: "peak_load_multiplier_other_detail",
  b2bOrgCount: "b2b_org_count",
  b2bAvgUsersPerOrg: "b2b_avg_users_per_org",
} as const;

const base = {
  tier: "proposal" as const,
  caseWorkerCount: 200,
  includeB2bPortal: true,
  b2bUserCount: 300,
  includeB2c: true,
  b2cMau: 25_000,
};

describe("5a Section 4 pricing invariance", () => {
  const withNull = makeQuote({ ...base, ...NULLS });
  const withValues = makeQuote({ ...base, ...POPULATED });

  it("pricing breakdown is identical with Section 4 null vs populated", () => {
    expect(calculatePricingBreakdown(withValues, TEST_CATALOG)).toEqual(
      calculatePricingBreakdown(withNull, TEST_CATALOG),
    );
  });

  it("WBS drivers and assumptions are identical", () => {
    expect(mapQuoteToDrivers(withValues)).toEqual(mapQuoteToDrivers(withNull));
    expect(buildAssumptions(withValues)).toEqual(buildAssumptions(withNull));
  });
});

describe("5e Section 4 row <-> Quote round trip", () => {
  const toRow = (q: Quote) =>
    Object.fromEntries(
      Object.keys(SECTION4_COLUMNS).map((k) => [
        QUOTE_FIELD_COLUMNS[k],
        q[k as keyof Quote],
      ]),
    );

  it("maps every field to the expected column", () => {
    for (const [k, col] of Object.entries(SECTION4_COLUMNS)) {
      expect(QUOTE_FIELD_COLUMNS[k]).toBe(col);
    }
  });

  for (const [label, values] of [
    ["populated", POPULATED],
    ["null", NULLS],
  ] as const) {
    it(`survives unchanged when ${label}`, () => {
      const row = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [
          SECTION4_COLUMNS[k as keyof typeof SECTION4_COLUMNS],
          v,
        ]),
      );
      const quote = rowToQuote({ id: "q", requested_by: "u", ...row } as never);
      for (const [k, v] of Object.entries(values)) {
        expect(quote[k as keyof Quote]).toBe(v);
      }
      expect(toRow(quote)).toEqual(row);
    });
  }
});

describe("Section 4 schema", () => {
  const valid = {
    ...makeQuote({ tier: "proposal", pricingSchedule: "list" }),
  };

  it("has no defaults (absent stays absent)", () => {
    const parsed = quoteSchema.parse(valid) as Record<string, unknown>;
    for (const k of Object.keys(SECTION4_COLUMNS)) {
      expect(parsed[k] ?? null).toBeNull();
    }
    const stripped = { ...valid } as Record<string, unknown>;
    for (const k of Object.keys(SECTION4_COLUMNS)) delete stripped[k];
    const p2 = quoteSchema.parse(stripped) as Record<string, unknown>;
    for (const k of Object.keys(SECTION4_COLUMNS)) expect(k in p2).toBe(false);
  });

  it("enforces Other-detail coherence on Proposals", () => {
    expect(
      quoteSchema.safeParse({ ...valid, expectedUserGrowth: "other" }).success,
    ).toBe(false);
    expect(
      quoteSchema.safeParse({
        ...valid,
        peakLoadMultiplier: "steady",
        peakLoadMultiplierOtherDetail: "x",
      }).success,
    ).toBe(false);
    expect(quoteSchema.safeParse({ ...valid, ...POPULATED }).success).toBe(true);
  });

  it("never blocks Ballpark submission (tier-gated)", () => {
    const ballpark = {
      ...makeQuote({ tier: "ballpark" }),
      expectedUserGrowth: "other",
      peakLoadMultiplier: "steady",
      peakLoadMultiplierOtherDetail: "orphan",
    };
    expect(quoteSchema.safeParse(ballpark).success).toBe(true);
  });

  it("caps studio users at 50", () => {
    expect(
      quoteSchema.safeParse({ ...valid, caseWorkerStudioUsers: 51 }).success,
    ).toBe(false);
  });
});
