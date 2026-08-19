import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/test-utils";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import type { Quote } from "@/types/quote";
import type { AppRole } from "@/lib/auth-types";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const intake = { quote: makeQuote(), quoteId: "q1", role: "sales_rep" as AppRole };
vi.mock("../IntakeContext", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useIntake: () => intake };
});

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "user-9" },
    profile: { full_name: "Ada Estimator", email: "ada@test.local" },
  }),
}));

const repsState = {
  data: [
    { id: "rep-1", name: "Rep One" },
    { id: "rep-2", name: "Rep Two" },
  ],
  isLoading: false,
};
vi.mock("@/hooks/useSalesReps", () => ({ useSalesReps: () => repsState }));

const mutate = vi.fn();
vi.mock("../useQuoteTransition", () => ({
  useQuoteTransition: () => ({ mutate, isPending: false }),
}));

vi.mock("@/features/pdf-export/QuotePdfDownloadButton", () => ({
  QuotePdfDownloadButton: () => <div data-testid="pdf-button" />,
}));
vi.mock("../VersionHistorySheet", () => ({
  VersionHistorySheet: () => <div data-testid="version-history" />,
}));

import { QuoteWorkflowBar } from "../QuoteWorkflowBar";

function setup(role: AppRole, overrides: Partial<Quote> = {}) {
  intake.role = role;
  intake.quote = makeQuote(overrides);
  return render(<QuoteWorkflowBar />);
}

beforeEach(() => {
  vi.clearAllMocks();
  repsState.isLoading = false;
});

describe("actions per role and state", () => {
  it("offers submit for a rep's draft", () => {
    setup("sales_rep", { state: "draft" });
    expect(screen.getByRole("button", { name: /submit for review/i })).toBeEnabled();
  });

  it("offers no pipeline actions to an external user on an approved quote", () => {
    setup("external", { state: "approved" });
    expect(screen.queryByRole("button", { name: /send to customer/i })).toBeNull();
  });

  it("offers send to customer once approved", () => {
    setup("sales_rep", { state: "approved" });
    expect(screen.getByRole("button", { name: /send to customer/i })).toBeEnabled();
  });

  it("offers approve and return to an estimator under review", () => {
    setup("estimator", { state: "under_review", ownerId: "rep-1" });
    expect(screen.getByRole("button", { name: /approve pricing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /return for more info/i })).toBeInTheDocument();
  });

  it("shows no actions in a terminal state", () => {
    setup("sales_rep", { state: "accepted" });
    expect(screen.queryByRole("button", { name: /mark/i })).toBeNull();
  });

  it("always renders the state badge and PDF button", () => {
    setup("sales_rep", { state: "approved" });
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-button")).toBeInTheDocument();
  });

  it("fires the transition when an action is clicked", async () => {
    const user = userEvent.setup();
    setup("sales_rep", { state: "draft" });
    await user.click(screen.getByRole("button", { name: /submit for review/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      actorName: "Ada Estimator",
      actorRole: "sales_rep",
    });
  });
});

describe("margin justification gate", () => {
  it("blocks approval when the margin is out of band with no justification", () => {
    setup("estimator", {
      state: "under_review",
      ownerId: "rep-1",
      marginPercent: 12,
      marginJustification: null,
    });
    expect(screen.getByRole("button", { name: /approve pricing/i })).toBeDisabled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("allows approval once a justification is present", () => {
    setup("estimator", {
      state: "under_review",
      ownerId: "rep-1",
      marginPercent: 12,
      marginJustification: "Competitive displacement deal approved by VP.",
    });
    expect(screen.getByRole("button", { name: /approve pricing/i })).toBeEnabled();
  });

  it("allows approval inside the 15-25 band without justification", () => {
    setup("estimator", { state: "under_review", ownerId: "rep-1", marginPercent: 20 });
    expect(screen.getByRole("button", { name: /approve pricing/i })).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks a rep submitting an out-of-band draft without justification", () => {
    setup("sales_rep", {
      state: "draft",
      marginPercent: 28,
      marginJustification: "",
    });
    expect(screen.getByRole("button", { name: /submit for review/i })).toBeDisabled();
  });

  it("does not fire a transition while blocked", async () => {
    const user = userEvent.setup();
    setup("sales_rep", { state: "draft", marginPercent: 28, marginJustification: "" });
    await user.click(screen.getByRole("button", { name: /submit for review/i }));
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe("sales rep assignment on approval", () => {
  it("shows the assign dropdown to an estimator who can approve", () => {
    setup("estimator", { state: "under_review", ownerId: null });
    expect(screen.getByLabelText(/assign to sales rep/i)).toBeInTheDocument();
  });

  it("hides the assign dropdown from a sales rep", () => {
    setup("sales_rep", { state: "approved" });
    expect(screen.queryByLabelText(/assign to sales rep/i)).toBeNull();
  });

  it("disables approval for an external-submitted quote with no rep", () => {
    setup("estimator", { state: "under_review", ownerId: null });
    const approve = screen.getByRole("button", { name: /approve pricing/i });
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute(
      "title",
      "Assign a sales rep before approving",
    );
  });

  it("explains that an external requester submitted the quote", () => {
    setup("estimator", { state: "under_review", ownerId: null });
    expect(
      screen.getByText(/assign a rep before approving/i),
    ).toBeInTheDocument();
  });

  it("enables approval when the quote already has an owner", () => {
    setup("estimator", { state: "under_review", ownerId: "rep-1" });
    expect(screen.getByRole("button", { name: /approve pricing/i })).toBeEnabled();
  });

  it("passes the assignment through to the transition", async () => {
    const user = userEvent.setup();
    setup("estimator", { state: "under_review", ownerId: "rep-1" });
    await user.click(screen.getByRole("button", { name: /approve pricing/i }));
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      assignRepId: "rep-1",
      assignRepName: "Rep One",
      previousRepName: "Rep One",
    });
  });
});

describe("return for more info", () => {
  it("opens a dialog rather than transitioning immediately", async () => {
    const user = userEvent.setup();
    setup("estimator", { state: "under_review", ownerId: "rep-1" });
    await user.click(screen.getByRole("button", { name: /return for more info/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("keeps the confirm button disabled below 20 characters", async () => {
    const user = userEvent.setup();
    setup("estimator", { state: "under_review", ownerId: "rep-1" });
    await user.click(screen.getByRole("button", { name: /return for more info/i }));
    await user.type(screen.getByLabelText(/what needs clarification/i), "too short");
    expect(screen.getByRole("button", { name: /return quote/i })).toBeDisabled();
  });

  it("enables the confirm button and submits the note", async () => {
    const user = userEvent.setup();
    setup("estimator", { state: "under_review", ownerId: "rep-1" });
    await user.click(screen.getByRole("button", { name: /return for more info/i }));
    await user.type(
      screen.getByLabelText(/what needs clarification/i),
      "Please clarify user count breakdown",
    );
    const confirm = screen.getByRole("button", { name: /return quote/i });
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      note: "Please clarify user count breakdown",
    });
  });
});
