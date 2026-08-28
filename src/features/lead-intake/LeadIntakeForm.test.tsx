import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { LeadIntakeForm } from "./LeadIntakeForm";

vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({ data: [] }),
}));

describe("LeadIntakeForm required-field validation", () => {
  it("blocks step 1 until organization, name and email are provided", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LeadIntakeForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText("Organization name is required")).toBeInTheDocument();
    expect(screen.getByText("Your name is required")).toBeInTheDocument();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 6/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    render(<LeadIntakeForm onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText(/organization name/i), "Acme County");
    await user.type(screen.getByLabelText(/your name/i), "Dana Rivers");
    await user.type(screen.getByLabelText(/work email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
  });

  it("advances through the groups and submits with the entered values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LeadIntakeForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/organization name/i), "Acme County");
    await user.type(screen.getByLabelText(/your name/i), "Dana Rivers");
    await user.type(screen.getByLabelText(/work email/i), "dana@acme.gov");

    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole("button", { name: /continue/i }));
    }

    expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      organization_name: "Acme County",
      contact_name: "Dana Rivers",
      contact_email: "dana@acme.gov",
    });
  });
});
