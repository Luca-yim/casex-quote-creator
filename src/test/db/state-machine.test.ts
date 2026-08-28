import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  cleanupQuotes,
  draftPayload,
  signInAllActors,
  SKIP_REASON,
  readQuote,
  transitionQuote,
  type TestActors,
} from "./supabase-clients";

let actors: TestActors;
let ready = false;
const created: string[] = [];

async function newDraft(overrides: Record<string, unknown> = {}): Promise<string | null> {
  const rep = actors.rep!;
  // The id is generated client-side; `authenticated` has no SELECT on
  // `public.quotes`, so the insert cannot read its own row back.
  const payload = draftPayload(rep.userId, overrides);
  const { error } = await rep.client.from("quotes").insert(payload);
  if (error) return null;
  created.push(payload.id);
  return payload.id;
}

beforeAll(async () => {
  actors = await signInAllActors();
  ready = actorsReady(actors);
  if (!ready) console.warn(SKIP_REASON);
});

afterAll(async () => {
  if (ready && actors.rep) await cleanupQuotes(actors.rep, created);
});

describe("quote state machine (database guard)", () => {
  it("allows draft → submitted_for_review by the owning rep", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    await actors.rep!.client
      .from("quotes")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", id);
    const { error } = await transitionQuote(actors.rep!, id, "submitted_for_review");
    expect(error).toBeNull();
    expect((await readQuote(actors.rep!, id, "state"))?.["state"]).toBe(
      "submitted_for_review",
    );
  });

  it("rejects draft → approved (skipping review)", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    const { error } = await transitionQuote(actors.rep!, id, "approved");
    expect(error).not.toBeNull();
  });

  it("rejects a rep approving their own submitted quote", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    await transitionQuote(actors.rep!, id, "submitted_for_review");
    const { error } = await transitionQuote(actors.rep!, id, "approved");
    expect(error).not.toBeNull();
  });

  it("allows an estimator to move submitted_for_review → under_review", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    await transitionQuote(actors.rep!, id, "submitted_for_review");
    // The app stamps reviewer identity before calling the state machine.
    await actors.estimator!.client
      .from("quotes")
      .update({ reviewed_by: actors.estimator!.userId })
      .eq("id", id);
    const { error } = await transitionQuote(actors.estimator!, id, "under_review");
    expect(error).toBeNull();
    expect((await readQuote(actors.estimator!, id, "state"))?.["state"]).toBe(
      "under_review",
    );
  });

  it("allows an estimator to return estimator_adjusted → draft", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    await transitionQuote(actors.rep!, id, "submitted_for_review");
    await actors.estimator!.client
      .from("quotes")
      .update({ reviewed_by: actors.estimator!.userId })
      .eq("id", id);
    await transitionQuote(actors.estimator!, id, "under_review");
    await transitionQuote(actors.estimator!, id, "estimator_adjusted");
    const { error } = await transitionQuote(actors.estimator!, id, "draft");
    expect(error).toBeNull();
    // Once returned, the draft is visible to its owner, not the estimator.
    expect((await readQuote(actors.rep!, id, "state"))?.["state"]).toBe("draft");
  });

  it("allows approve then send_to_customer by the owning rep", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    await transitionQuote(actors.rep!, id, "submitted_for_review");
    await transitionQuote(actors.estimator!, id, "under_review");
    const approved = await transitionQuote(actors.estimator!, id, "approved");
    expect(approved.error).toBeNull();

    const { error } = await transitionQuote(actors.rep!, id, "sent_to_customer");
    expect(error).toBeNull();
    expect((await readQuote(actors.rep!, id, "state"))?.["state"]).toBe(
      "sent_to_customer",
    );
  });

  it("rejects reopening an accepted quote", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    await transitionQuote(actors.rep!, id, "submitted_for_review");
    await transitionQuote(actors.estimator!, id, "under_review");
    await transitionQuote(actors.estimator!, id, "approved");
    await transitionQuote(actors.rep!, id, "sent_to_customer");
    await transitionQuote(actors.rep!, id, "accepted");
    const { error } = await transitionQuote(actors.rep!, id, "draft");
    expect(error).not.toBeNull();
  });

  it("rejects an unknown state value", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    const { error } = await transitionQuote(actors.rep!, id, "totally_invalid");
    expect(error).not.toBeNull();
  });
});
