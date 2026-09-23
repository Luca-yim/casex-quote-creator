import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, FormProvider, useWatch, useFormContext } from "react-hook-form";
import {
  TEST_CATALOG,
  makeQuote,
} from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { calculatePricingBreakdown } from "@/lib/calculation-engine/baseline-calculator";
import { quoteSchema, type Quote, type QuoteFormData } from "@/types/quote";
import { IntakeProvider, type IntakeContextValue } from "../IntakeContext";
import { UserSizingSection } from "../sections/UserSizingSection";
import { QUOTE_FIELD_COLUMNS, rowToQuote } from "../quote-mapper";

vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({ data: [], isLoading: false }),
}));

const S4_FIELDS = [
  "caseWorkerStudioUsers",
  "expectedUserGrowth",
  "expectedUserGrowthOtherDetail",
  "peakLoadMultiplier",
  "peakLoadMultiplierOtherDetail",
  "b2bOrgCount",
  "b2bAvgUsersPerOrg",
] as const;

const POPULATED: Partial<Quote> = {
  caseWorkerStudioUsers: 8,
  expectedUserGrowth: "other",
  expectedUserGrowthOtherDetail: "Phased county rollout",
  peakLoadMultiplier: "high_burst",
  peakLoadMultiplierOtherDetail: null,
  b2bOrgCount: 100,
  b2bAvgUsersPerOrg: 3,
};

const NULLS: Partial<Quote> = Object.fromEntries(S4_FIELDS.map((f) => [f, null]));

describe("5a Section 4 pricing invariance", () => {
  it("produces an identical breakdown with Section 4 null vs populated", () => {
    const base = {
      tier: "proposal" as const,
      includeB2bPortal: true,
      b2bUserCount: 300,
      includeB2c: true,
      b2cMau: 25_000,
      caseWorkerCount: 200,
    };
    const a = calculatePricingBreakdown(makeQuote({ ...base, ...NULLS }), TEST_CATALOG);
    const b = calculatePricingBreakdown(makeQuote({ ...base, ...POPULATED }), TEST_CATALOG);
    expect(b).toEqual(a);
  });
});

function Harness({ quote, updateField }: { quote: Quote; updateField: (p: string, v: unknown) => void }) {
  const form = useForm<QuoteFormData>({
    defaultValues: {
      caseWorkerCount: quote.caseWorkerCount,
      includeB2bPortal: quote.includeB2bPortal,
      ...Object.fromEntries(S4_FIELDS.map((f) => [f, quote[f]])),
    } as Partial<QuoteFormData> as QuoteFormData,
  });
  const Probe = () => {
    const { control } = useFormContext<QuoteFormData>();
    const g = useWatch({ control, name: "expectedUserGrowthOtherDetail" });
    const p = useWatch({ control, name: "peakLoadMultiplierOtherDetail" });
    return (
      <>
        <input data-testid="growth-detail" value={g ?? "<null>"} readOnly />
        <input data-testid="peak-detail" value={p ?? "<null>"} readOnly />
      </>
    );
  };
  return (
    <IntakeProvider
      value={
        {
          quoteId: quote.id,
          quote,
          role: "estimator",
          mode: "edit",
          showPricing: true,
          updateField,
          flushSave: vi.fn(async () => {}),
          isSaving: false,
          lastSavedAt: null,
          hasPendingChanges: false,
          validationErrors: {},
        } as IntakeContextValue
      }
    >
      <FormProvider {...form}>
        <UserSizingSection />
        <Probe />
      </FormProvider>
    </IntakeProvider>
  );
}

const LABELS = [
  /case worker studio users/i,
  /expected user growth/i,
  /peak load profile/i,
  /number of b2b organizations/i,
  /average users per b2b organization/i,
];

beforeEach(() => vi.clearAllMocks());
const user = userEvent.setup({ pointerEventsCheck: 0 });

describe("5b Section 4 tier separation", () => {
  it("renders none of the five controls on a Ballpark quote", () => {
    render(
      <Harness quote={makeQuote({ tier: "ballpark", includeB2bPortal: true })} updateField={vi.fn()} />,
    );
    for (const l of LABELS) expect(screen.queryByLabelText(l)).not.toBeInTheDocument();
  });

  it("renders all five controls on a Proposal quote with B2B portal on", () => {
    render(
      <Harness quote={makeQuote({ tier: "proposal", includeB2bPortal: true })} updateField={vi.fn()} />,
    );
    for (const l of LABELS) expect(screen.getByLabelText(l)).toBeInTheDocument();
  });

  it("hides Q4.8/Q4.9 when the B2B portal is off", () => {
    render(
      <Harness quote={makeQuote({ tier: "proposal", includeB2bPortal: false })} updateField={vi.fn()} />,
    );
    expect(screen.queryByLabelText(LABELS[3]!)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(LABELS[4]!)).not.toBeInTheDocument();
  });

  it("Ballpark schema validation ignores Section 4 coherence rules", () => {
    const issues = (tier: "ballpark" | "proposal") =>
      quoteSchema
        .safeParse({ ...makeQuote({ tier }), expectedUserGrowth: "other", expectedUserGrowthOtherDetail: "" })
        .error?.issues.filter((i) => i.path[0] === "expectedUserGrowthOtherDetail") ?? [];
    expect(issues("ballpark")).toHaveLength(0);
    expect(issues("proposal")).toHaveLength(1);
  });
});

describe("5c Section 4 no autosave on mount", () => {
  it("does not call the save handler and fields start blank", () => {
    const updateField = vi.fn();
    render(
      <Harness
        quote={makeQuote({ tier: "proposal", includeB2bPortal: true, caseWorkerCount: 200, ...NULLS })}
        updateField={updateField}
      />,
    );
    expect(updateField).not.toHaveBeenCalled();
    expect(screen.getByLabelText(LABELS[0]!)).toHaveValue(null);
    expect(screen.getByText(/suggested: 8/)).toBeInTheDocument();
  });
});

describe("5d Section 4 Other-detail clearing", () => {
  it("clears Q4.3 detail when growth leaves Other", async () => {
    const updateField = vi.fn();
    render(
      <Harness
        quote={makeQuote({ tier: "proposal", expectedUserGrowth: "other", expectedUserGrowthOtherDetail: "Spiky" })}
        updateField={updateField}
      />,
    );
    expect(screen.getByTestId("growth-detail")).toHaveValue("Spiky");
    screen.getByRole("combobox", { name: /expected user growth/i }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}"); // Other -> Moderate
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("growth-detail")).toHaveValue("<null>");
    expect(updateField).toHaveBeenCalledWith("expectedUserGrowthOtherDetail", null);
  });

  it("clears Q4.6 detail when peak profile leaves Other", async () => {
    const updateField = vi.fn();
    render(
      <Harness
        quote={makeQuote({ tier: "proposal", peakLoadMultiplier: "other", peakLoadMultiplierOtherDetail: "Tax season" })}
        updateField={updateField}
      />,
    );
    screen.getByRole("combobox", { name: /peak load profile/i }).focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}"); // Other -> Steady
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("peak-detail")).toHaveValue("<null>");
    expect(updateField).toHaveBeenCalledWith("peakLoadMultiplierOtherDetail", null);
  });
});

describe("5e Section 4 round trip", () => {
  const toRow = (q: Quote) =>
    Object.fromEntries(S4_FIELDS.map((f) => [QUOTE_FIELD_COLUMNS[f]!, q[f]]));
  const baseRow = { id: "q", requested_by: "u", created_at: "x", updated_at: "x" };

  for (const [label, values] of [["populated", POPULATED], ["null", NULLS]] as const) {
    it(`survives row -> Quote -> row (${label})`, () => {
      const row = { ...baseRow, ...toRow(makeQuote(values)) };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quote = rowToQuote(row as any);
      for (const f of S4_FIELDS) expect(quote[f]).toBe((values as Record<string, unknown>)[f]);
      expect(toRow(quote)).toEqual(toRow(makeQuote(values)));
    });
  }
});
