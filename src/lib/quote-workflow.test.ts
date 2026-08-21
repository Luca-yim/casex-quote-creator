import { describe, expect, it } from "vitest";
import {
  STATE_LABELS,
  availableActions,
  canEditIntake,
  stageOwner,
} from "./quote-workflow";
import type { AppRole } from "@/lib/auth-types";
import type { QuoteState } from "@/types/quote";

const ROLES: AppRole[] = ["external", "sales_rep", "estimator", "admin"];
const STATES = Object.keys(STATE_LABELS) as QuoteState[];

function actionsFor(role: AppRole, state: QuoteState) {
  return availableActions(role, state).map((a) => a.action);
}

describe("availableActions — requesters", () => {
  it.each(["external", "sales_rep", "admin"] as AppRole[])(
    "%s can submit a draft for review",
    (role) => {
      expect(actionsFor(role, "draft")).toContain("submit_for_review");
    },
  );

  it("estimator can submit their own draft", () => {
    expect(actionsFor("estimator", "draft")).toEqual(["submit_for_review"]);
  });

  it("external cannot approve from any state", () => {
    for (const state of STATES) {
      expect(actionsFor("external", state)).not.toContain("approve");
    }
  });

  it("sales rep cannot approve from any state", () => {
    for (const state of STATES) {
      expect(actionsFor("sales_rep", state)).not.toContain("approve");
    }
  });

  it("sales rep cannot skip straight to sent_to_customer from draft", () => {
    expect(actionsFor("sales_rep", "draft")).not.toContain("send_to_customer");
  });
});

describe("availableActions — estimator", () => {
  it("starts review from submitted_for_review", () => {
    expect(actionsFor("estimator", "submitted_for_review")).toEqual([
      "start_review",
    ]);
  });

  it("can adjust, approve or return while under review", () => {
    expect(actionsFor("estimator", "under_review")).toEqual([
      "mark_adjusted",
      "approve",
      "return_to_sales",
    ]);
  });

  it("has no actions on a returned (rep-owned) quote", () => {
    expect(actionsFor("estimator", "estimator_adjusted")).toEqual([]);
  });

  it("has nothing to do once approved", () => {
    expect(actionsFor("estimator", "approved")).toEqual([]);
  });

  it("return_to_sales routes to estimator_adjusted", () => {
    const action = availableActions("estimator", "under_review").find(
      (a) => a.action === "return_to_sales",
    );
    expect(action?.next).toBe("estimator_adjusted");
  });

  it("approve routes to approved", () => {
    const action = availableActions("estimator", "under_review").find(
      (a) => a.action === "approve",
    );
    expect(action?.next).toBe("approved");
  });
});

describe("availableActions — sales rep post-approval", () => {
  it("can send an approved quote to the customer", () => {
    expect(actionsFor("sales_rep", "approved")).toEqual(["send_to_customer"]);
  });

  it("can close a sent quote as accepted or declined", () => {
    expect(actionsFor("sales_rep", "sent_to_customer")).toEqual([
      "mark_accepted",
      "mark_declined",
    ]);
  });

  it("external cannot send to customer", () => {
    expect(actionsFor("external", "approved")).toEqual([]);
  });
});

describe("terminal states", () => {
  it.each(["accepted", "declined", "archived"] as QuoteState[])(
    "%s exposes no actions for any role",
    (state) => {
      for (const role of ROLES) {
        expect(actionsFor(role, state)).toEqual([]);
      }
    },
  );
});

describe("admin", () => {
  it("holds the union of requester and estimator powers", () => {
    expect(actionsFor("admin", "under_review")).toEqual([
      "mark_adjusted",
      "approve",
      "return_to_sales",
    ]);
    expect(actionsFor("admin", "draft")).toContain("submit_for_review");
    expect(actionsFor("admin", "approved")).toContain("send_to_customer");
  });

  it("cannot approve directly from a returned quote", () => {
    // Backend state machine rejects estimator_adjusted -> approved.
    expect(actionsFor("admin", "estimator_adjusted")).not.toContain("approve");
    expect(actionsFor("admin", "estimator_adjusted")).not.toContain(
      "return_to_sales",
    );
  });
});

describe("action metadata", () => {
  it("every returned action carries a label, next state and description", () => {
    for (const role of ROLES) {
      for (const state of STATES) {
        for (const action of availableActions(role, state)) {
          expect(action.label).toBeTruthy();
          expect(STATES).toContain(action.next);
          expect(action.description).toBeTruthy();
          expect(["default", "outline", "secondary", "destructive"]).toContain(
            action.variant,
          );
        }
      }
    }
  });

  it("never returns duplicate actions", () => {
    for (const role of ROLES) {
      for (const state of STATES) {
        const list = actionsFor(role, state);
        expect(new Set(list).size).toBe(list.length);
      }
    }
  });
});

describe("canEditIntake", () => {
  it("admin can always edit", () => {
    for (const state of STATES) expect(canEditIntake("admin", state)).toBe(true);
  });

  it.each(["external", "sales_rep"] as AppRole[])(
    "%s can edit drafts and returned adjustments only",
    (role) => {
      expect(canEditIntake(role, "draft")).toBe(true);
      expect(canEditIntake(role, "estimator_adjusted")).toBe(true);
      expect(canEditIntake(role, "submitted_for_review")).toBe(false);
      expect(canEditIntake(role, "under_review")).toBe(false);
      expect(canEditIntake(role, "approved")).toBe(false);
      expect(canEditIntake(role, "sent_to_customer")).toBe(false);
    },
  );

  it("estimator edits own drafts and the review window", () => {
    expect(canEditIntake("estimator", "submitted_for_review")).toBe(true);
    expect(canEditIntake("estimator", "under_review")).toBe(true);
    expect(canEditIntake("estimator", "estimator_adjusted")).toBe(false);
    expect(canEditIntake("estimator", "draft")).toBe(true);
    expect(canEditIntake("estimator", "approved")).toBe(false);
  });

  it("nobody but admin edits terminal states", () => {
    for (const state of ["accepted", "declined", "archived"] as QuoteState[]) {
      for (const role of ["external", "sales_rep", "estimator"] as AppRole[]) {
        expect(canEditIntake(role, state)).toBe(false);
      }
    }
  });
});

describe("state metadata", () => {
  it("labels every state", () => {
    for (const state of STATES) expect(STATE_LABELS[state]).toBeTruthy();
  });

  it("describes an owner for every state", () => {
    for (const state of STATES) expect(stageOwner(state).length).toBeGreaterThan(0);
  });

  it("puts drafts with the requester", () => {
    expect(stageOwner("draft")).toMatch(/requester/i);
  });

  it("puts review states with the estimator", () => {
    expect(stageOwner("under_review")).toMatch(/estimator/i);
  });
});
