import { describe, expect, it, beforeEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/test-utils";
import type { AppRole } from "@/lib/auth-types";
import { rowToLead, type Lead } from "../lead-mapper";

const updatePayloads: Array<Record<string, unknown>> = [];

const eq = vi.fn(() => Promise.resolve({ error: null }));
const update = vi.fn((patch: Record<string, unknown>) => {
  updatePayloads.push(patch);
  return { eq };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ update }) },
}));

const authState: { role: AppRole } = { role: "sales_rep" };
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ role: authState.role, user: { id: "me-1" } }),
}));

vi.mock("@/hooks/useAssignableOwners", () => ({
  useAssignableOwners: () => ({
    data: [{ id: "rep-2", name: "Sarah Lee", role: "sales_rep" }],
  }),
  ownerOptionLabel: (o: { name: string }) => o.name,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LeadRowActions } from "../LeadRowActions";

function lead(overrides: Partial<Lead> = {}): Lead {
  const base = rowToLead({
    id: "lead-1",
    organization_name: "Acme County",
    contact_name: "Dana Ruiz",
    contact_email: "dana@acme.gov",
    status: "new_lead",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  } as never);
  return { ...base, ...overrides };
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: /lead actions/i }));
}

beforeEach(() => {
  updatePayloads.length = 0;
  update.mockClear();
  authState.role = "sales_rep";
});

describe("LeadRowActions", () => {
  it("claim writes all four fields in a single update", async () => {
    render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    await userEvent.click(await screen.findByText(/claim lead/i));

    await vi.waitFor(() => expect(updatePayloads).toHaveLength(1));
    const patch = updatePayloads[0]!;
    expect(patch["claimed_by"]).toBe("me-1");
    expect(patch["assigned_rep_id"]).toBe("me-1");
    expect(patch["status"]).toBe("claimed");
    expect(typeof patch["claimed_at"]).toBe("string");
  });

  it("hides claim once the lead is already claimed by someone", async () => {
    render(
      <LeadRowActions
        lead={lead({ claimedBy: "other", assignedRepId: "other", status: "claimed" })}
        otherLeads={[]}
      />,
    );
    await openMenu();
    expect(screen.queryByText(/claim lead/i)).not.toBeInTheDocument();
  });

  it("hides assign from sales reps and shows it to admins", async () => {
    const { unmount } = render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    expect(screen.queryByText(/assign to rep/i)).not.toBeInTheDocument();
    unmount();

    authState.role = "admin";
    render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    expect(await screen.findByText(/assign to rep/i)).toBeInTheDocument();
  });

  it("hides mark-duplicate from sales reps and shows it to estimators", async () => {
    const { unmount } = render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    expect(screen.queryByText(/mark duplicate/i)).not.toBeInTheDocument();
    unmount();

    authState.role = "estimator";
    render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    expect(await screen.findByText(/mark duplicate/i)).toBeInTheDocument();
  });

  it("qualify only changes status, leaving assignment untouched", async () => {
    render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    await userEvent.click(await screen.findByText(/^Qualify$/));

    await vi.waitFor(() => expect(updatePayloads).toHaveLength(1));
    expect(updatePayloads[0]).toEqual({ status: "qualified" });
  });

  it("shows 'Assign & claim' to estimators on unclaimed leads", async () => {
    authState.role = "estimator";
    render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    expect(await screen.findByText(/assign & claim/i)).toBeInTheDocument();
  });

  it("hides 'Assign & claim' once the lead is claimed", async () => {
    authState.role = "estimator";
    render(
      <LeadRowActions
        lead={lead({ claimedBy: "other", assignedRepId: "other", status: "claimed" })}
        otherLeads={[]}
      />,
    );
    await openMenu();
    expect(screen.queryByText(/assign & claim/i)).not.toBeInTheDocument();
  });

  it("hides 'Assign & claim' from sales reps", async () => {
    render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    expect(screen.queryByText(/assign & claim/i)).not.toBeInTheDocument();
  });

  it("assign-and-claim writes all four fields for the selected rep", async () => {
    authState.role = "estimator";
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<LeadRowActions lead={lead()} otherLeads={[]} />);
    await openMenu();
    await user.click(await screen.findByText(/assign & claim/i));

    const trigger = screen.getByLabelText(/assign and claim to/i);
    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "Sarah Lee" });
    await user.click(option);
    await user.click(screen.getByRole("button", { name: /^Assign & claim$/i }));

    await vi.waitFor(() => expect(updatePayloads).toHaveLength(1));
    const patch = updatePayloads[0]!;
    expect(patch["assigned_rep_id"]).toBe("rep-2");
    expect(patch["claimed_by"]).toBe("rep-2");
    expect(patch["status"]).toBe("claimed");
    expect(typeof patch["claimed_at"]).toBe("string");
  });
});
