import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@/test/test-utils";
import { LeadIntakeForm, leadIntakeSchema } from "../LeadIntakeForm";
import { CUSTOMER_TYPE_OPTIONS, toLeadCustomerType } from "../lead-intake-options";

vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({ data: [] }),
}));
vi.mock("@/hooks/useVerticalLabels", () => ({
  useVerticalLabels: () => ({ options: [] }),
  OTHER_VERTICAL: "other",
}));

describe("lead customer type", () => {
  it("offers exactly the six lead-side values with public labels", () => {
    expect(CUSTOMER_TYPE_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["state", "State agency"],
      ["federal", "Federal agency"],
      ["county", "County or city government"],
      ["tribal", "Tribal government"],
      ["commercial", "Private company"],
      ["unsure", "Not sure"],
    ]);
  });

  it.each(CUSTOMER_TYPE_OPTIONS.map((o) => o.value))("stores %s as its exact lowercase value", (v) => {
    expect(toLeadCustomerType(v)).toBe(v);
  });

  it("never maps state to a NASPO-split quote value", () => {
    expect(toLeadCustomerType("state")).toBe("state");
  });

  it.each(["", "   ", null, undefined])("saves blank %j as null", (v) => {
    expect(toLeadCustomerType(v)).toBeNull();
  });

  it("is optional in the schema", () => {
    const shape = leadIntakeSchema.safeParse({
      organization_name: "Acme",
      contact_name: "",
      contact_email: "a@acme.gov",
      contact_phone: "",
      region: "",
      customer_type: "",
      vertical: "",
      solution: "",
      vertical_other_detail: "",
      internal_user_count: null,
      external_portal_required: false,
      external_portal_monthly_logins: null,
      b2b_portal_required: false,
      b2b_user_count: null,
      hosting_preference: "",
      compliance_requirements: [],
      integration_required: false,
      integration_count: null,
      integration_difficulty: "",
      additional_notes: "",
    });
    expect(shape.success).toBe(true);
  });

  it("submits without a customer type and shows the control on the contact step", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LeadIntakeForm onSubmit={onSubmit} />);
    for (let i = 0; i < 5; i += 1) {
      await user.click(screen.getByRole("button", { name: /continue/i }));
    }
    expect(screen.getByLabelText(/organization type/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/organization name/i), "Acme County");
    await user.type(screen.getByLabelText(/work email/i), "dana@acme.gov");
    await user.click(screen.getByRole("button", { name: /submit request/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const values = onSubmit.mock.calls[0]![0];
    expect(values.customer_type).toBe("");
    expect(toLeadCustomerType(values.customer_type)).toBeNull();
  });
});
