import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import type { Quote } from "@/types/quote";
import type { AppRole } from "@/lib/auth-types";
import { IntakeProvider, type IntakeContextValue } from "../IntakeContext";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-9" }, profile: { full_name: "Rep One" } }),
}));

vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({
    data: [
      { vertical: "HealthCx", solution: "medicaid", display_label: "Medicaid" },
      { vertical: "HealthCx", solution: "chip", display_label: "CHIP" },
    ],
    isLoading: false,
  }),
}));

const submitMutate = vi.fn();
vi.mock("../useSubmitQuote", () => ({
  useSubmitQuote: () => ({ mutate: submitMutate, isPending: false }),
}));

import { IntakeForm } from "../IntakeForm";

const updateField = vi.fn();

function setup(
  role: AppRole,
  mode: "edit" | "readonly" = "edit",
  quoteOverrides: Partial<Quote> = {},
) {
  const quote = makeQuote({ state: "draft", ...quoteOverrides });
  const value: IntakeContextValue = {
    quoteId: quote.id,
    quote,
    role,
    mode,
    showPricing: role === "estimator",
    updateField,
    flushSave: vi.fn(async () => {}),
    isSaving: false,
    lastSavedAt: null,
    validationErrors: {},
  };
  return {
    quote,
    ...render(
      <IntakeProvider value={value}>
        <IntakeForm />
      </IntakeProvider>,
    ),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("rendering", () => {
  it("renders every intake section", () => {
    setup("sales_rep");
    for (const title of [
      "Customer Info",
      "Target Go-Live",
      "Vertical & Solution",
      "Compliance",
      "Module Tier",
      "Case Workers",
      "B2C Portal",
      "B2B Portal",
      "Hosting",
      "Integrations",
      "Support Tier",
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("hydrates fields from the quote", () => {
    setup("sales_rep", "edit", {
      name: "Nevada Health",
      customerName: "State of Nevada",
    });
    expect(screen.getByLabelText(/quote name/i)).toHaveValue("Nevada Health");
    expect(screen.getByLabelText(/customer organization/i)).toHaveValue(
      "State of Nevada",
    );
  });

  it("does not submit the browser form on enter", async () => {
    const user = userEvent.setup();
    setup("sales_rep");
    const input = screen.getByLabelText(/quote name/i);
    await user.type(input, "abc{Enter}");
    expect(input).toHaveValue("abc");
  });
});

describe("auto-save wiring", () => {
  it("pushes field edits through updateField", async () => {
    const user = userEvent.setup();
    setup("sales_rep");
    await user.type(screen.getByLabelText(/quote name/i), "Ne");
    await waitFor(() => expect(updateField).toHaveBeenCalled());
    expect(updateField).toHaveBeenLastCalledWith("name", expect.stringContaining("Ne"));
  });

  it("saves the customer email field too", async () => {
    const user = userEvent.setup();
    setup("sales_rep");
    await user.type(screen.getByLabelText(/contact email/i), "a@b.gov");
    await waitFor(() =>
      expect(updateField).toHaveBeenCalledWith("customerEmail", "a@b.gov"),
    );
  });

  it("never calls updateField in readonly mode", async () => {
    const user = userEvent.setup();
    setup("sales_rep", "readonly");
    const input = screen.getByLabelText(/quote name/i);
    await user.type(input, "x");
    expect(updateField).not.toHaveBeenCalled();
  });
});

describe("readonly locking", () => {
  it("marks the form aria-disabled", () => {
    const { container } = setup("sales_rep", "readonly");
    expect(container.querySelector("form")).toHaveAttribute("aria-disabled", "true");
  });

  it("disables text inputs", () => {
    setup("sales_rep", "readonly");
    expect(screen.getByLabelText(/quote name/i)).toBeDisabled();
    expect(screen.getByLabelText(/customer organization/i)).toBeDisabled();
  });

  it("leaves inputs editable in edit mode", () => {
    setup("sales_rep", "edit");
    expect(screen.getByLabelText(/quote name/i)).toBeEnabled();
  });
});

describe("conditional sections", () => {
  it("hides the MAU band until the B2C portal is enabled", () => {
    setup("sales_rep", "edit", { includeB2c: false });
    expect(screen.queryByText(/monthly active users/i)).toBeNull();
  });

  it("shows the MAU band when the B2C portal is included", () => {
    setup("sales_rep", "edit", { includeB2c: true, b2cMau: 5000 });
    expect(screen.getByText(/monthly active users/i)).toBeInTheDocument();
  });

  it("reveals the MAU band after toggling the switch", async () => {
    const user = userEvent.setup();
    setup("sales_rep", "edit", { includeB2c: false });
    await user.click(screen.getByLabelText(/include a public citizen portal/i));
    expect(await screen.findByText(/monthly active users/i)).toBeInTheDocument();
    expect(updateField).toHaveBeenCalledWith("includeB2c", true);
  });
});

describe("returned-note callout", () => {
  it("stays hidden for a fresh draft", () => {
    setup("sales_rep", "edit", { returnNote: null });
    expect(screen.queryByText(/returned for more info/i)).toBeNull();
  });
});
