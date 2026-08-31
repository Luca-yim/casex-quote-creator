import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { within } from "@testing-library/react";
import { render, screen } from "@/test/test-utils";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import type { Quote } from "@/types/quote";
import type { AppRole } from "@/lib/auth";
import { IntakeProvider, type IntakeContextValue } from "@/features/intake/IntakeContext";
import { PromoteToProposalButton } from "../PromoteToProposalButton";

const mutate = vi.fn();

vi.mock("../usePromoteToProposal", () => ({
  usePromoteToProposal: () => ({ mutate, isPending: false }),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    useAuth: () => ({
      user: { id: "u1" },
      profile: { full_name: "Dana Estimator", email: "dana@example.com" },
      role: "estimator",
      loading: false,
      profileLoading: false,
    }),
  };
});

function renderButton(overrides: Partial<Quote>, role: AppRole = "estimator") {
  const quote = { ...makeQuote(), state: "under_review", tier: "ballpark", ...overrides } as Quote;
  const value = {
    quoteId: quote.id,
    quote,
    role,
    mode: "edit",
    showPricing: true,
    updateField: vi.fn(),
    flushSave: vi.fn(),
    isSaving: false,
    lastSavedAt: null,
    hasPendingChanges: false,
    validationErrors: {},
  } as unknown as IntakeContextValue;
  return render(
    <IntakeProvider value={value}>
      <PromoteToProposalButton />
    </IntakeProvider>,
  );
}

describe("PromoteToProposalButton", () => {
  beforeEach(() => mutate.mockClear());

  it("is hidden for a sales rep", () => {
    renderButton({}, "sales_rep");
    expect(screen.queryByRole("button", { name: /convert to proposal/i })).toBeNull();
  });

  it("is hidden once the quote is already a proposal", () => {
    renderButton({ tier: "proposal" } as Partial<Quote>);
    expect(screen.queryByRole("button", { name: /convert to proposal/i })).toBeNull();
  });

  it("is hidden outside the under_review window", () => {
    renderButton({ state: "approved" } as Partial<Quote>);
    expect(screen.queryByRole("button", { name: /convert to proposal/i })).toBeNull();
  });

  it("requires confirmation before promoting", async () => {
    const user = userEvent.setup();
    renderButton({});

    await user.click(screen.getByRole("button", { name: /convert to proposal/i }));
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    // Cancelling must not promote.
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mutate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /convert to proposal/i }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getAllByRole("button", { name: /convert to proposal/i }).at(-1)!;
    await user.click(confirm);
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
