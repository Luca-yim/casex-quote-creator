import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { LeadIntakeForm } from "./LeadIntakeForm";

vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({ data: [] }),
}));

vi.mock("@/hooks/useVerticalLabels", () => ({
  useVerticalLabels: () => ({ options: [] }),
  OTHER_VERTICAL: "other",
}));

describe("LeadIntakeForm required-field validation", () => {
  it("blocks the final step until organization and email are provided", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LeadIntakeForm onSubmit={onSubmit} />);

    // Advance through the five optional-ish front steps.
    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole("button", { name: /continue/i }));
    }

    expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByText("Organization name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.queryByText("Your name is required")).not.toBeInTheDocument();
    expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    render(<LeadIntakeForm onSubmit={vi.fn()} />);

    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole("button", { name: /continue/i }));
    }

    await user.type(screen.getByLabelText(/organization name/i), "Acme County");
    await user.type(screen.getByLabelText(/work email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
  });

  it("advances through the groups and submits with the entered values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LeadIntakeForm onSubmit={onSubmit} />);

    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole("button", { name: /continue/i }));
    }

    expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/organization name/i), "Acme County");
    await user.type(screen.getByLabelText(/your name/i), "Dana Rivers");
    await user.type(screen.getByLabelText(/work email/i), "dana@acme.gov");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      organization_name: "Acme County",
      contact_name: "Dana Rivers",
      contact_email: "dana@acme.gov",
    });
  });
});
