import { describe, expect, it } from "vitest";
import { canClaimLead, canPerformLeadAction } from "../permissions";
import { rowToLead, isUnclaimed, type Lead } from "../lead-mapper";
import type { AppRole } from "@/lib/auth-types";

function lead(overrides: Partial<Lead> = {}): Lead {
  const base = rowToLead({
    id: "lead-1",
    organization_name: "Acme County",
    contact_name: "Dana Ruiz",
    contact_email: "dana@acme.gov",
    status: "new",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  } as never);
  return { ...base, ...overrides };
}

const ROLES: AppRole[] = ["external", "sales_rep", "estimator", "admin"];

describe("lead action gating", () => {
  it("keeps claim/qualify/disqualify open to all three internal roles", () => {
    for (const action of ["claim", "qualify", "disqualify"] as const) {
      expect(canPerformLeadAction("sales_rep", action)).toBe(true);
      expect(canPerformLeadAction("estimator", action)).toBe(true);
      expect(canPerformLeadAction("admin", action)).toBe(true);
      expect(canPerformLeadAction("external", action)).toBe(false);
      expect(canPerformLeadAction(null, action)).toBe(false);
    }
  });

  it("restricts assign to admins only, narrower than the RLS ceiling", () => {
    const allowed = ROLES.filter((r) => canPerformLeadAction(r, "assign"));
    expect(allowed).toEqual(["admin"]);
  });

  it("restricts mark-duplicate to estimator and admin", () => {
    const allowed = ROLES.filter((r) => canPerformLeadAction(r, "duplicate"));
    expect(allowed).toEqual(["estimator", "admin"]);
  });
});

describe("claim availability", () => {
  it("is offered only on a genuinely unheld lead", () => {
    expect(canClaimLead("sales_rep", lead())).toBe(true);
  });

  it("is hidden once someone claimed it", () => {
    const held = lead({ claimedBy: "user-9", assignedRepId: "user-9", status: "claimed" });
    expect(isUnclaimed(held)).toBe(false);
    expect(canClaimLead("sales_rep", held)).toBe(false);
    expect(canClaimLead("admin", held)).toBe(false);
  });

  it("is hidden when only assigned_rep_id is set (admin-assigned, unclaimed)", () => {
    expect(canClaimLead("sales_rep", lead({ assignedRepId: "user-3" }))).toBe(false);
  });
});
