import { describe, expect, it } from "vitest";
import { canDeleteDraft } from "../useDeleteQuote";

const base = {
  state: "draft" as const,
  requestedBy: "user-1",
  submittedAt: null as string | null,
};

describe("canDeleteDraft", () => {
  it("allows the requester to delete their own unsubmitted draft", () => {
    expect(canDeleteDraft(base, "user-1", "sales_rep")).toBe(true);
    expect(canDeleteDraft(base, "user-1", "external")).toBe(true);
  });

  it("blocks other users", () => {
    expect(canDeleteDraft(base, "user-2", "sales_rep")).toBe(false);
    expect(canDeleteDraft(base, undefined, "external")).toBe(false);
  });

  it("allows admins regardless of requester", () => {
    expect(canDeleteDraft(base, "user-2", "admin")).toBe(true);
  });

  it("blocks anything that left draft state", () => {
    expect(canDeleteDraft({ ...base, state: "under_review" }, "user-1", "admin")).toBe(false);
    expect(canDeleteDraft({ ...base, state: "approved" }, "user-1", "sales_rep")).toBe(false);
  });

  it("blocks a draft that was already submitted once (returned to requester)", () => {
    expect(
      canDeleteDraft({ ...base, submittedAt: "2026-08-01T00:00:00Z" }, "user-1", "admin"),
    ).toBe(false);
  });
});
