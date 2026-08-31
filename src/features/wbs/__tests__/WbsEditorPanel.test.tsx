import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/test-utils";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import type { Quote } from "@/types/quote";
import { IntakeProvider, type IntakeContextValue } from "@/features/intake/IntakeContext";
import { WbsEditorPanel } from "../WbsEditorPanel";
import type { CostItemRow, WbsLineRow } from "../useWbsData";

/**
 * NAIA Phase 3 regression numbers (see
 * `src/lib/pricing-engine/__fixtures__/naia-phase3.test.ts`): 22,880 cost
 * hours at $35 plus a $28,000 non-labor item = $828,800 grand total cost.
 */
const NAIA_LINE: WbsLineRow = {
  id: "line-1",
  phase: "Build",
  area: "Core",
  role: "Developer",
  location: "Offshore",
  costHours: 22_880,
  revenueHours: 22_880,
  costRate: 35,
  billRate: 55,
  personDays: 2860,
};

const NAIA_ITEM: CostItemRow = {
  id: "item-1",
  name: "Travel",
  itemType: "travel",
  amount: 28_000,
  customerVisible: true,
};

const store: { lines: WbsLineRow[]; items: CostItemRow[] } = { lines: [], items: [] };
const rerender = { fn: () => {} };

vi.mock("../useWbsData", () => ({
  useWbsLines: () => ({ data: store.lines, isLoading: false }),
  useQuoteCostItems: () => ({ data: store.items, isLoading: false }),
  useRateCardOptions: () => ({
    data: [{ role: "Developer", location: "Offshore", billRate: 55, costRate: 35 }],
    isLoading: false,
  }),
  usePhaseOptions: () => ({ data: ["Build"], isLoading: false }),
  useAddWbsLine: () => ({
    mutate: (line: Omit<WbsLineRow, "id" | "personDays">, opts?: { onSuccess?: () => void }) => {
      store.lines = [
        ...store.lines,
        { ...(line as WbsLineRow), id: `l${store.lines.length + 1}`, personDays: null },
      ];
      opts?.onSuccess?.();
      rerender.fn();
    },
    isPending: false,
  }),
  useDeleteWbsLine: () => ({
    mutate: (id: string) => {
      store.lines = store.lines.filter((l) => l.id !== id);
      rerender.fn();
    },
    isPending: false,
  }),
  useAddCostItem: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCostItem: () => ({
    mutate: (id: string) => {
      store.items = store.items.filter((i) => i.id !== id);
      rerender.fn();
    },
    isPending: false,
  }),
}));

function renderPanel() {
  const quote = {
    ...makeQuote(),
    state: "under_review",
    tier: "proposal",
    customerType: "state_naspo",
  } as unknown as Quote;
  const value = {
    quoteId: quote.id,
    quote,
    role: "estimator",
    mode: "edit",
    showPricing: true,
    updateField: vi.fn(),
    flushSave: vi.fn(),
    isSaving: false,
    lastSavedAt: null,
    hasPendingChanges: false,
    validationErrors: {},
  } as unknown as IntakeContextValue;
  const view = render(
    <IntakeProvider value={value}>
      <WbsEditorPanel />
    </IntakeProvider>,
  );
  rerender.fn = () =>
    view.rerender(
      <IntakeProvider value={value}>
        <WbsEditorPanel />
      </IntakeProvider>,
    );
  return view;
}

const total = () => screen.getByTestId("wbs-grand-total").textContent ?? "";

describe("WbsEditorPanel", () => {
  beforeEach(() => {
    store.lines = [];
    store.items = [];
  });

  it("starts at a zero cost basis with no lines", () => {
    renderPanel();
    expect(total()).toMatch(/\$0/);
  });

  it("totals the NAIA fixture line plus its non-labor item", () => {
    store.lines = [NAIA_LINE];
    store.items = [NAIA_ITEM];
    renderPanel();
    expect(total()).toContain("828,800");
  });

  it("updates the running total when a line is added and deleted", async () => {
    const user = userEvent.setup();
    store.items = [NAIA_ITEM];
    renderPanel();
    expect(total()).toContain("28,000");

    await user.click(screen.getByLabelText(/phase/i));
    await user.click(await screen.findByRole("option", { name: "Build" }));
    await user.click(screen.getByLabelText(/role \/ location/i));
    await user.click(await screen.findByRole("option", { name: /Developer/ }));
    await user.type(screen.getByLabelText(/cost hours/i), "22880");
    await user.type(screen.getByLabelText(/revenue hours/i), "22880");
    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(total()).toContain("828,800");

    await user.click(screen.getByRole("button", { name: /delete line/i }));
    expect(total()).toContain("28,000");
  });
});
