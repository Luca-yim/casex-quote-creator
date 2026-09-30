import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
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
const updateCalls: {
  lines: { id: string; patch: Record<string, unknown> }[];
  items: { id: string; patch: Record<string, unknown> }[];
} = { lines: [], items: [] };

vi.mock("../useWbsData", () => ({
  useWbsLines: () => ({ data: store.lines, isLoading: false }),
  useQuoteCostItems: () => ({ data: store.items, isLoading: false }),
  useRateCardOptions: () => ({
    data: [{ role: "Developer", location: "offshore", billRate: 55, costRate: 35 }],
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
  useUpdateWbsLine: () => ({
    mutate: (
      { id, patch }: { id: string; patch: Partial<WbsLineRow> },
      opts?: { onSuccess?: () => void },
    ) => {
      updateCalls.lines.push({ id, patch });
      store.lines = store.lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
      opts?.onSuccess?.();
      rerender.fn();
    },
    isPending: false,
  }),
  useUpdateCostItem: () => ({
    mutate: (
      { id, patch }: { id: string; patch: Partial<CostItemRow> },
      opts?: { onSuccess?: () => void },
    ) => {
      updateCalls.items.push({ id, patch });
      store.items = store.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
      opts?.onSuccess?.();
      rerender.fn();
    },
    isPending: false,
  }),
  useDeleteCostItem: () => ({
    mutate: (id: string) => {
      store.items = store.items.filter((i) => i.id !== id);
      rerender.fn();
    },
    isPending: false,
  }),
}));

function renderPanel(state = "under_review") {
  const quote = {
    ...makeQuote(),
    state,
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

// jsdom lacks the pointer APIs Radix Select probes on open.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto["hasPointerCapture"] = () => false;
  proto["setPointerCapture"] = () => {};
  proto["releasePointerCapture"] = () => {};
  proto["scrollIntoView"] = () => {};
});

describe("WbsEditorPanel", () => {
  beforeEach(() => {
    store.lines = [];
    store.items = [];
    updateCalls.lines = [];
    updateCalls.items = [];
  });

  it("starts at a zero cost basis with no lines", () => {
    renderPanel();
    expect(total()).toMatch(/\$0/);
  });

  it.each(["approved", "sent_to_customer", "accepted", "declined"])(
    "hides edit/delete controls and entry forms when state is %s",
    (state) => {
      store.lines = [NAIA_LINE];
      store.items = [NAIA_ITEM];
      renderPanel(state);
      expect(screen.queryByRole("button", { name: /edit line|delete line|edit cost item|delete cost item/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /add line/i })).toBeNull();
      expect(screen.getByText(/this quote is committed/i)).toBeInTheDocument();
    },
  );

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
    await user.click(screen.getByLabelText(/^role$/i));
    await user.click(await screen.findByRole("option", { name: /Developer/ }));
    await user.click(screen.getByLabelText(/^location$/i));
    await user.click(await screen.findByRole("option", { name: "Offshore" }));
    await user.type(screen.getByLabelText(/cost hours/i), "22880");
    await user.type(screen.getByLabelText(/revenue hours/i), "22880");

    const addLine = screen.getByRole("button", { name: /add line/i });
    // Area is required — the button stays disabled until Area is filled.
    expect(addLine).toBeDisabled();
    expect(total()).toContain("28,000");

    await user.type(screen.getByLabelText(/area/i), "Core");
    await user.click(screen.getByRole("button", { name: /add line/i }));

    expect(total()).toContain("828,800");

    await user.click(screen.getByRole("button", { name: /delete line/i }));
    expect(total()).toContain("28,000");
  });

  it("edits a line's hours without re-snapshotting its rates", async () => {
    const user = userEvent.setup();
    store.lines = [NAIA_LINE];
    renderPanel();
    await user.click(screen.getByRole("button", { name: /edit line/i }));
    const cost = screen.getByLabelText(/cost hours/i);
    await user.clear(cost);
    await user.type(cost, "1000");
    await user.click(screen.getByRole("button", { name: /save line/i }));

    expect(updateCalls.lines).toHaveLength(1);
    const { id, patch } = updateCalls.lines[0]!;
    expect(id).toBe("line-1");
    expect(patch["costHours"]).toBe(1000);
    expect(patch).not.toHaveProperty("costRate");
    expect(patch).not.toHaveProperty("billRate");
    expect(total()).toContain("35,000");
    expect(screen.getByRole("button", { name: /add line/i })).toBeInTheDocument();
  });

  it("blocks saving an edited line with a blank Area", async () => {
    const user = userEvent.setup();
    store.lines = [NAIA_LINE];
    renderPanel();
    await user.click(screen.getByRole("button", { name: /edit line/i }));
    await user.clear(screen.getByLabelText(/area/i));
    expect(screen.getByRole("button", { name: /save line/i })).toBeDisabled();
  });

  it("cancel leaves the line untouched", async () => {
    const user = userEvent.setup();
    store.lines = [NAIA_LINE];
    renderPanel();
    await user.click(screen.getByRole("button", { name: /edit line/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(updateCalls.lines).toHaveLength(0);
    expect(total()).toContain("800,800");
  });

  it("edits a cost item amount", async () => {
    const user = userEvent.setup();
    store.items = [NAIA_ITEM];
    renderPanel();
    await user.click(screen.getByRole("button", { name: /edit cost item/i }));
    const amount = screen.getByLabelText(/amount/i);
    await user.clear(amount);
    await user.type(amount, "5000");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(updateCalls.items[0]?.patch["amount"]).toBe(5000);
    expect(total()).toContain("5,000");
  });
});
