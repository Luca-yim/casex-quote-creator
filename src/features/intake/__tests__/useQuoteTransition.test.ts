import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, TestProviders } from "@/test/test-utils";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { availableActions } from "@/lib/quote-workflow";
import type { QueryClient } from "@tanstack/react-query";

/** Result of the `transition_quote()` RPC, which now owns state changes. */
const rpcResult = vi.fn();
const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => rpcResult());
/** Result of the plain field-stamp UPDATE that accompanies a transition. */
const stampResult = vi.fn();
const update = vi.fn((_patch: Record<string, unknown>) => ({
  eq: () => stampResult(),
}));

const commentInsert = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) =>
      table === "quote_comments" ? { insert: commentInsert } : { update },
    ),
    rpc: (...args: [string, Record<string, unknown>]) => rpc(...args),
  },
}));

const writeVersionSnapshot = vi.fn();
vi.mock("@/lib/version-snapshot", () => ({
  writeVersionSnapshot: (...args: unknown[]) => writeVersionSnapshot(...args),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}));

vi.mock("../quote-mapper", () => ({
  rowToQuote: (row: Record<string, unknown>) => ({
    ...row,
    id: row["id"],
    ownerId: row["owner_id"] ?? null,
    state: row["state"],
  }),
}));

import { useQuoteTransition } from "../useQuoteTransition";

const QUOTE = makeQuote({ state: "under_review", ownerId: null });
const approveAction = availableActions("estimator", "under_review").find(
  (a) => a.action === "approve",
)!;
const returnAction = availableActions("estimator", "under_review").find(
  (a) => a.action === "return_to_sales",
)!;
const submitAction = availableActions("sales_rep", "draft")[0]!;

function setup(queryClient: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(TestProviders, { queryClient, children });
  const hook = renderHook(() => useQuoteTransition("q1", "user-9"), { wrapper });
  return { hook, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  rpcResult.mockResolvedValue({ data: null, error: null });
  stampResult.mockResolvedValue({ data: null, error: null });
  commentInsert.mockResolvedValue({ error: null });
  writeVersionSnapshot.mockResolvedValue({ version_number: 2 });
});

describe("successful transitions", () => {
  it("patches the state and stamps approved_at / approved_by on approve", async () => {
    const { hook } = setup();
    hook.result.current.mutate({
      action: approveAction,
      quote: QUOTE,
      actorName: "Ada",
      assignRepId: "rep-1",
      assignRepName: "Rep One",
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(rpc).toHaveBeenCalledWith("transition_quote", {
      p_quote_id: "q1",
      p_new_state: "approved",
    });
    const patch = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch["approved_by"]).toBe("user-9");
    expect(patch["approved_at"]).toBeTruthy();
    expect(patch["owner_id"]).toBe("rep-1");
  });

  it("stamps submitted_at when submitting for review", async () => {
    const { hook } = setup();
    hook.result.current.mutate({
      action: submitAction,
      quote: makeQuote(),
      actorName: "Rep",
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(update.mock.calls[0]?.[0]).toHaveProperty("submitted_at");
  });

  it("writes a version snapshot with the approve change type", async () => {
    const { hook } = setup();
    hook.result.current.mutate({
      action: approveAction,
      quote: QUOTE,
      actorName: "Ada",
      assignRepId: "rep-1",
      assignRepName: "Rep One",
    });
    await waitFor(() => expect(writeVersionSnapshot).toHaveBeenCalled());
    expect(writeVersionSnapshot.mock.calls[0]?.[0]).toMatchObject({
      quoteId: "q1",
      changeType: "approve",
      changedBy: "user-9",
    });
  });

  it("records the assignment in the change reason", async () => {
    const { hook } = setup();
    hook.result.current.mutate({
      action: approveAction,
      quote: QUOTE,
      actorName: "Ada",
      assignRepId: "rep-1",
      assignRepName: "Rep One",
    });
    await waitFor(() => expect(writeVersionSnapshot).toHaveBeenCalled());
    expect(writeVersionSnapshot.mock.calls[0]?.[0].changeReason).toContain(
      "assigned to Rep One",
    );
  });

  it("notes a reassignment when the owner changes", async () => {
    const { hook } = setup();
    hook.result.current.mutate({
      action: approveAction,
      quote: makeQuote({ state: "under_review", ownerId: "rep-0" }),
      actorName: "Ada",
      assignRepId: "rep-1",
      assignRepName: "Rep One",
      previousRepName: "Rep Zero",
    });
    await waitFor(() => expect(writeVersionSnapshot).toHaveBeenCalled());
    expect(writeVersionSnapshot.mock.calls[0]?.[0].changeReason).toContain(
      "reassigned from Rep Zero to Rep One",
    );
  });

  it("saves the return note as a quote comment", async () => {
    const { hook } = setup();
    hook.result.current.mutate({
      action: returnAction,
      quote: QUOTE,
      actorName: "Ada",
      actorRole: "estimator",
      note: "Please clarify the case worker count breakdown",
    });
    await waitFor(() => expect(commentInsert).toHaveBeenCalled());
    expect(commentInsert.mock.calls[0]?.[0]).toMatchObject({
      quote_id: "q1",
      author_id: "user-9",
      body: "Please clarify the case worker count breakdown",
    });
    expect(writeVersionSnapshot.mock.calls[0]?.[0].changeType).toBe("return");
  });

  it("caches the updated quote and invalidates dependent queries", async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const setQueriesData = vi.spyOn(queryClient, "setQueriesData");
    const { hook } = setup(queryClient);
    hook.result.current.mutate({
      action: submitAction,
      quote: makeQuote(),
      actorName: "Rep",
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    // gcTime is 0 in tests, so assert the write rather than the cached value.
    // The detail read key is ["quote", id, role], so the write must be
    // prefix-scoped or it lands on an entry nobody reads.
    expect(setQueriesData).toHaveBeenCalledWith(
      { queryKey: ["quote", "q1"] },
      expect.objectContaining({ state: "submitted_for_review" }),
    );
    const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toContain(JSON.stringify(["quotes"]));
    expect(keys).toContain(JSON.stringify(["quote", "q1"]));
    expect(keys).toContain(JSON.stringify(["quote-versions", "q1"]));
    expect(keys).toContain(JSON.stringify(["quote-comments", "q1"]));
    expect(toastSuccess).toHaveBeenCalled();
  });
});

describe("failure handling", () => {
  it("surfaces an RLS denial to the caller as an error state", async () => {
    rpcResult.mockResolvedValue({
      data: null,
      error: { message: "new row violates row-level security policy", code: "42501" },
    });
    const { hook } = setup();
    hook.result.current.mutate({
      action: approveAction,
      quote: QUOTE,
      actorName: "Ada",
      assignRepId: "rep-1",
    });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(toastError).toHaveBeenCalled();
    expect(toastError.mock.calls[0]?.[1]).toMatchObject({
      description: expect.stringMatching(/isn't allowed/i),
    });
  });

  it("does not write a snapshot when the update fails", async () => {
    rpcResult.mockResolvedValue({ data: null, error: { message: "denied" } });
    const { hook } = setup();
    hook.result.current.mutate({
      action: submitAction,
      quote: makeQuote(),
      actorName: "Rep",
    });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(writeVersionSnapshot).not.toHaveBeenCalled();
  });

  it("still succeeds but warns when the audit snapshot fails", async () => {
    writeVersionSnapshot.mockRejectedValue(new Error("audit denied"));
    const { hook } = setup();
    hook.result.current.mutate({
      action: submitAction,
      quote: makeQuote(),
      actorName: "Rep",
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(toastWarning).toHaveBeenCalledWith(
      "Audit trail incomplete",
      expect.objectContaining({
        description: expect.stringContaining("audit denied"),
      }),
    );
  });

  it("warns but does not fail when the return note cannot be saved", async () => {
    commentInsert.mockResolvedValue({ error: { message: "comment denied" } });
    const { hook } = setup();
    hook.result.current.mutate({
      action: returnAction,
      quote: QUOTE,
      actorName: "Ada",
      note: "Please clarify the case worker count breakdown",
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(toastWarning).toHaveBeenCalledWith(
      "Return note could not be saved",
      expect.anything(),
    );
  });
});
