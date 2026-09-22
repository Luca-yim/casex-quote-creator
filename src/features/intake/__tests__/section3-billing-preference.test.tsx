import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, FormProvider, useWatch, useFormContext } from "react-hook-form";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import type { Quote, QuoteFormData } from "@/types/quote";
import type { AppRole } from "@/lib/auth-types";
import { IntakeProvider, type IntakeContextValue } from "../IntakeContext";
import { BillingPreferenceSection } from "../sections/BillingPreferenceSection";

vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({ data: [], isLoading: false }),
}));

function Harness({
  role,
  mode = "edit",
  quote,
}: {
  role: AppRole;
  mode?: "edit" | "readonly";
  quote: Quote;
}) {
  const form = useForm<QuoteFormData>({
    defaultValues: {
      billingPreference: quote.billingPreference,
      billingPreferenceOtherDetail: quote.billingPreferenceOtherDetail,
    } as Partial<QuoteFormData> as QuoteFormData,
  });
  const DetailProbe = () => {
    const { control } = useFormContext<QuoteFormData>();
    const v = useWatch({ control, name: "billingPreferenceOtherDetail" });
    return <input data-testid="detail-probe" value={v ?? ""} readOnly />;
  };
  return (
    <IntakeProvider
      value={
        {
          quoteId: quote.id,
          quote,
          role,
          mode,
          showPricing: role === "estimator",
          updateField: vi.fn(),
          flushSave: vi.fn(async () => {}),
          isSaving: false,
          lastSavedAt: null,
          hasPendingChanges: false,
          validationErrors: {},
        } as IntakeContextValue
      }
    >
      <FormProvider {...form}>
        <BillingPreferenceSection />
        <DetailProbe />
      </FormProvider>
    </IntakeProvider>
  );
}

const proposal = (overrides: Partial<Quote> = {}): Quote =>
  makeQuote({ tier: "proposal", state: "draft", ...overrides });

beforeEach(() => vi.clearAllMocks());

// jsdom lacks hasPointerCapture; keyboard-only interaction avoids it.
const user = userEvent.setup({ pointerEventsCheck: 0 });

describe("Q3.4 BillingPreferenceSection rendering", () => {
  it("renders blank (no selection) initially", () => {
    render(<Harness role="sales_rep" quote={proposal()} />);
    const trigger = screen.getByLabelText(/billing preference/i);
    expect(trigger).toHaveTextContent(/select billing preference/i);
  });

  it("renders for estimator, admin and sales rep on a Proposal", () => {
    for (const role of ["sales_rep", "estimator", "admin"] as const) {
      const { unmount } = render(<Harness role={role} quote={proposal()} />);
      expect(screen.getByLabelText(/billing preference/i)).toBeInTheDocument();
      unmount();
    }
  });

  it("is absent from Ballpark quotes", () => {
    render(
      <Harness role="sales_rep" quote={makeQuote({ tier: "ballpark" })} />,
    );
    expect(screen.queryByLabelText(/billing preference/i)).not.toBeInTheDocument();
  });

  it("is absent for external users", () => {
    render(<Harness role="external" mode="readonly" quote={proposal()} />);
    expect(screen.queryByLabelText(/billing preference/i)).not.toBeInTheDocument();
  });

  it("reveals the Other detail input only when Other is selected", async () => {
    // Keyboard-driven Radix Select: pointer events hit a jsdom
    // hasPointerCapture gap, so drive the dropdown with keys instead.
    render(<Harness role="sales_rep" quote={proposal()} />);
    expect(
      screen.queryByLabelText(/describe the billing preference/i),
    ).not.toBeInTheDocument();
    const trigger = screen.getByRole("combobox", { name: /billing preference/i });
    trigger.focus();
    await user.keyboard("{Enter}"); // open
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}"); // highlight Other
    await user.keyboard("{Enter}"); // select
    expect(
      screen.getByLabelText(/describe the billing preference/i),
    ).toBeInTheDocument();
  });

  it("clears the Other detail when the preference changes away from Other", async () => {
    render(
      <Harness
        role="sales_rep"
        quote={proposal({
          billingPreference: "other",
          billingPreferenceOtherDetail: "Milestone invoicing",
        })}
      />,
    );
    expect(screen.getByTestId("detail-probe")).toHaveValue("Milestone invoicing");
    const trigger = screen.getByRole("combobox", { name: /billing preference/i });
    trigger.focus();
    await user.keyboard("{Enter}"); // open
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}"); // highlight Monthly
    await user.keyboard("{Enter}"); // select
    expect(screen.getByTestId("detail-probe")).toHaveValue("");
    expect(
      screen.queryByLabelText(/describe the billing preference/i),
    ).not.toBeInTheDocument();
  });

  it("disables the controls in readonly mode", () => {
    render(<Harness role="estimator" mode="readonly" quote={proposal()} />);
    expect(screen.getByLabelText(/billing preference/i)).toBeDisabled();
  });
});
