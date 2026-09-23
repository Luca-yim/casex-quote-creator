import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, FormProvider, useWatch, useFormContext } from "react-hook-form";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import type { Quote, QuoteFormData } from "@/types/quote";
import type { AppRole } from "@/lib/auth-types";
import { IntakeProvider, type IntakeContextValue } from "../IntakeContext";
import { UserSizingSection } from "../sections/UserSizingSection";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-9" }, profile: { full_name: "Rep One" } }),
}));
vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({ data: [], isLoading: false }),
}));
vi.mock("../useSubmitQuote", () => ({
  useSubmitQuote: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { IntakeForm } from "../IntakeForm";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const updateField = vi.fn();

function ctx(quote: Quote, role: AppRole = "estimator"): IntakeContextValue {
  return {
    quoteId: quote.id,
    quote,
    role,
    mode: "edit",
    showPricing: role === "estimator",
    updateField,
    flushSave: vi.fn(async () => {}),
    isSaving: false,
    lastSavedAt: null,
    hasPendingChanges: false,
    validationErrors: {},
  } as IntakeContextValue;
}

/** Section harness wired like IntakeForm: watch(change) -> updateField. */
function Harness({ quote }: { quote: Quote }) {
  const form = useForm<QuoteFormData>({
    defaultValues: {
      includeB2bPortal: quote.includeB2bPortal,
      caseWorkerCount: quote.caseWorkerCount,
      caseWorkerStudioUsers: quote.caseWorkerStudioUsers,
      expectedUserGrowth: quote.expectedUserGrowth,
      expectedUserGrowthOtherDetail: quote.expectedUserGrowthOtherDetail,
      peakLoadMultiplier: quote.peakLoadMultiplier,
      peakLoadMultiplierOtherDetail: quote.peakLoadMultiplierOtherDetail,
      b2bOrgCount: quote.b2bOrgCount,
      b2bAvgUsersPerOrg: quote.b2bAvgUsersPerOrg,
    } as Partial<QuoteFormData> as QuoteFormData,
  });
  form.watch((_v, { name, type }) => {
    if (name && type === "change") updateField(name, form.getValues(name as never));
  });
  const Probe = ({ name }: { name: "expectedUserGrowthOtherDetail" | "peakLoadMultiplierOtherDetail" }) => {
    const { control } = useFormContext<QuoteFormData>();
    const v = useWatch({ control, name });
    return <span data-testid={name}>{v === null ? "NULL" : String(v ?? "")}</span>;
  };
  return (
    <IntakeProvider value={ctx(quote)}>
      <FormProvider {...form}>
        <UserSizingSection />
        <Probe name="expectedUserGrowthOtherDetail" />
        <Probe name="peakLoadMultiplierOtherDetail" />
      </FormProvider>
    </IntakeProvider>
  );
}

function renderForm(quote: Quote) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <IntakeProvider value={ctx(quote)}>
        <IntakeForm />
      </IntakeProvider>
    </QueryClientProvider>,
  );
}

const LABELS = [
  /case worker studio users/i,
  /expected user growth/i,
  /peak load profile/i,
  /number of b2b organizations/i,
  /average users per b2b organization/i,
];

const user = userEvent.setup({ pointerEventsCheck: 0 });
beforeEach(() => vi.clearAllMocks());

describe("5b Section 4 tier separation", () => {
  it("Ballpark IntakeForm renders none of the five controls", () => {
    renderForm(makeQuote({ tier: "ballpark", includeB2bPortal: true, state: "draft" }));
    for (const l of LABELS) expect(screen.queryByLabelText(l)).not.toBeInTheDocument();
  });

  it("Proposal IntakeForm renders all five controls", () => {
    renderForm(makeQuote({ tier: "proposal", includeB2bPortal: true, state: "draft" }));
    for (const l of LABELS) expect(screen.getByLabelText(l)).toBeInTheDocument();
  });

  it("Q4.8/Q4.9 hidden when B2B portal is off", () => {
    render(<Harness quote={makeQuote({ tier: "proposal", includeB2bPortal: false })} />);
    expect(screen.queryByLabelText(LABELS[3]!)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(LABELS[4]!)).not.toBeInTheDocument();
    expect(screen.getByLabelText(LABELS[0]!)).toBeInTheDocument();
  });
});

describe("5c no autosave on mount", () => {
  it("does not call the save handler and fields start blank", () => {
    render(
      <Harness
        quote={makeQuote({ tier: "proposal", includeB2bPortal: true, caseWorkerCount: 200 })}
      />,
    );
    expect(updateField).not.toHaveBeenCalled();
    expect(screen.getByLabelText(LABELS[0]!)).toHaveValue(null);
    expect(screen.getByLabelText(LABELS[3]!)).toHaveValue(null);
    expect(screen.getByLabelText(LABELS[4]!)).toHaveValue(null);
    expect(screen.getByText(/suggested: 8/i)).toBeInTheDocument();
  });
});

describe("5d Other-detail clearing", () => {
  it("Q4.3 detail becomes null when leaving Other", async () => {
    render(
      <Harness
        quote={makeQuote({
          tier: "proposal",
          expectedUserGrowth: "other",
          expectedUserGrowthOtherDetail: "Custom",
        })}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: /expected user growth/i });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}"); // other -> moderate
    await user.keyboard("{Enter}");
    expect(trigger).toHaveTextContent("Moderate");
    expect(screen.getByTestId("expectedUserGrowthOtherDetail")).toHaveTextContent("NULL");
  });

  it("Q4.6 detail becomes null when leaving Other", async () => {
    render(
      <Harness
        quote={makeQuote({
          tier: "proposal",
          peakLoadMultiplier: "other",
          peakLoadMultiplierOtherDetail: "Custom",
        })}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: /peak load profile/i });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}"); // other -> steady
    await user.keyboard("{Enter}");
    expect(trigger).toHaveTextContent("Steady");
    expect(screen.getByTestId("peakLoadMultiplierOtherDetail")).toHaveTextContent("NULL");
  });
});
