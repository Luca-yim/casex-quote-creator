import { renderHook, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { createTestQueryClient, TestProviders } from "@/test/test-utils";
import { makeQuote, TEST_CATALOG } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { grandTotalCost, totalImplementationFee } from "@/lib/pricing-engine/fullQuote";

/** NAIA Phase 3 fixture: 22,880 hrs @ $35 cost + $28,000 non-labor = $828,800. */
const NAIA_HOURS = 22_880;
const wbsRows = [
  {
    id: "line-1",
    quote_id: "q",
    phase: "Build",
    area: null,
    role: "Engineer",
    location: "Offshore",
    cost_hours: NAIA_HOURS,
    revenue_hours: NAIA_HOURS,
    cost_rate: 35,
    bill_rate: 55,
    person_days: null,
    created_at: "2026-01-01",
  },
];
const costRows = [
  {
    id: "item-1",
    quote_id: "q",
    name: "Travel",
    cost_type: "travel",
    amount: 28_000,
    is_customer_visible: false,
    created_at: "2026-01-01",
  },
];

const catalogResponse = { data: TEST_CATALOG, error: null as { message: string } | null };

vi.mock("@/lib/supabase", () => {
  const orderable = (rows: unknown[]) => ({
    select: () => ({
      eq: () => ({ order: async () => ({ data: rows, error: null }) }),
    }),
  });
  return {
    supabase: {
      from: (table: string) => {
        if (table === "pricing_catalog") {
          return { select: () => ({ order: async () => catalogResponse }) };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { email: "rep@test.local", full_name: "Rep One" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "quote_wbs_lines") return orderable(wbsRows);
        if (table === "quote_cost_items") return orderable(costRows);
        return { insert: async () => ({ error: null }) };
      },
      storage: { from: () => ({ upload: async () => ({ error: null }) }) },
      auth: { getUser: async () => ({ data: { user: { id: "user-9" } } }) },
    },
  };
});

vi.mock("@/lib/version-snapshot", () => ({ writeVersionSnapshot: async () => undefined }));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const toBlob = vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" }));
vi.mock("@react-pdf/renderer", () => ({ pdf: () => ({ toBlob }) }));

/** Captures the context handed to the document tree. */
const captured: Record<string, unknown>[] = [];
vi.mock("../QuotePdfDocument", () => ({
  QuotePdfDocument: (props: { context: Record<string, unknown> }) => {
    captured.push(props.context);
    return null;
  },
}));

import { useQuotePdfDownload } from "../useQuotePdfDownload";

const PROPOSAL_QUOTE = makeQuote({
  id: "abcd1234-0000-0000-0000-000000000000",
  state: "approved",
  customerName: "Naia County",
  tier: "proposal",
  marginPercent: 35,
  contingencyPct: 0.05,
});

const BALLPARK_QUOTE = makeQuote({
  id: "ffff1234-0000-0000-0000-000000000000",
  state: "approved",
  customerName: "Acme County",
  tier: "ballpark",
});

function setup(queryClient: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(TestProviders, { queryClient, children });
  return renderHook(() => useQuotePdfDownload(), { wrapper });
}

/** Every key present anywhere in the object graph. */
function allKeys(value: unknown, seen = new Set<object>()): string[] {
  if (value === null || typeof value !== "object") return [];
  if (value instanceof Date) return [];
  if (seen.has(value)) return [];
  seen.add(value);
  if (Array.isArray(value)) return value.flatMap((v) => allKeys(v, seen));
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [
    k,
    ...allKeys(v, seen),
  ]);
}

beforeEach(() => {
  captured.length = 0;
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});

describe("customer PDF data for a proposal-tier quote", () => {
  it("contains no cost-basis keys anywhere in its object graph", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(PROPOSAL_QUOTE, "customer");
    });
    const context = captured[0]!;
    const keys = allKeys(context);
    for (const forbidden of [
      "lines",
      "items",
      "marginPercent",
      "contingencyPct",
      "grandTotalCost",
      "costRate",
      "billRate",
      "costHours",
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("exposes only the five customer quote fields", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(PROPOSAL_QUOTE, "customer");
    });
    const quote = captured[0]!['quote'] as Record<string, unknown>;
    expect(Object.keys(quote).sort()).toEqual([
      "customerEmail",
      "customerName",
      "id",
      "name",
      "tier",
    ]);
  });

  it("carries only the implementation fee as pricing", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(PROPOSAL_QUOTE, "customer");
    });
    const pricing = captured[0]!['pricing'] as Record<string, unknown>;
    expect(Object.keys(pricing).sort()).toEqual(["kind", "totalImplementationFee"]);
    expect(pricing['kind']).toBe("proposal");
  });
});

describe("internal PDF data for a proposal-tier quote", () => {
  it("matches the NAIA fixture engine totals", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(PROPOSAL_QUOTE, "internal");
    });
    const pricing = captured[0]!['pricing'] as Record<string, unknown>;
    const cost = grandTotalCost(
      [{ costHours: NAIA_HOURS, costRate: 35, revenueHours: NAIA_HOURS, billRate: 55 }],
      [{ amount: 28_000 }],
    );
    expect(cost).toBeCloseTo(828_800, 2);
    expect(pricing['grandTotalCost']).toBeCloseTo(828_800, 2);
    expect(pricing['totalImplementationFee']).toBeCloseTo(
      totalImplementationFee(35, cost, 0.05),
      2,
    );
    expect(pricing['totalImplementationFee']).toBeCloseTo(1_338_830.77, 0);
    expect((pricing['lines'] as unknown[]).length).toBe(1);
    expect((pricing['items'] as unknown[]).length).toBe(1);
  });

  it("agrees with the customer fee for the same quote", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(PROPOSAL_QUOTE, "internal");
      await result.current.generatePdf(PROPOSAL_QUOTE, "customer");
    });
    const internal = captured[0]!['pricing'] as Record<string, number>;
    const customer = captured[1]!['pricing'] as Record<string, number>;
    expect(customer['totalImplementationFee']).toBeCloseTo(
      internal['totalImplementationFee'] as number,
      2,
    );
  });
});

describe("ballpark tier", () => {
  it("still uses the catalog breakdown for both audiences", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(BALLPARK_QUOTE, "customer");
      await result.current.generatePdf(BALLPARK_QUOTE, "internal");
    });
    for (const context of captured) {
      const pricing = context['pricing'] as Record<string, unknown>;
      expect(pricing['kind']).toBe("ballpark");
      expect(pricing['breakdown']).toBeDefined();
    }
  });
});
