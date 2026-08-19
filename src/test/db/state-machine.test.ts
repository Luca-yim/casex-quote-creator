import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  cleanupQuotes,
  draftPayload,
  signInAllActors,
  SKIP_REASON,
  type TestActors,
} from "./supabase-clients";

let actors: TestActors;
let ready = false;
const created: string[] = [];

async function newDraft(overrides: Record<string, unknown> = {}): Promise<string | null> {
  const rep = actors.rep!;
  const { data } = await rep.client
    .from("quotes")
    .insert(draftPayload(rep.userId, overrides))
    .select("id")
    .single();
  if (data?.id) created.push(data.id);
  return data?.id ?? null;
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
    const { data, error } = await actors.rep!.client
      .from("quotes")
      .update({ state: "submitted_for_review", submitted_at: new Date().toISOString() })
      .eq("id", id)
      .select("state")
      .single();
    expect(error).toBeNull();
    expect(data?.state).toBe("submitted_for_review");
  });

  it("rejects draft → approved (skipping review)", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    const { error } = await actors.rep!.client
      .from("quotes")
      .update({ state: "approved" })
      .eq("id", id);
    expect(error).not.toBeNull();
  });

  it("rejects a rep approving their own submitted quote", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    await actors.rep!.client
      .from("quotes")
      .update({ state: "submitted_for_review" })
      .eq("id", id);
    const { error } = await actors.rep!.client
      .from("quotes")
      .update({ state: "approved" })
      .eq("id", id);
    expect(error).not.toBeNull();
  });

  it("allows an estimator to move submitted_for_review → under_review", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    await actors.rep!.client.from("quotes").update({ state: "submitted_for_review" }).eq("id", id);
    const { data, error } = await actors.estimator!.client
      .from("quotes")
      .update({ state: "under_review" })
      .eq("id", id)
      .select("state")
      .single();
    expect(error).toBeNull();
    expect(data?.state).toBe("under_review");
  });

  it("allows an estimator to return estimator_adjusted → draft", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    const est = actors.estimator!.client;
    await actors.rep!.client.from("quotes").update({ state: "submitted_for_review" }).eq("id", id);
    await est.from("quotes").update({ state: "under_review" }).eq("id", id);
    await est.from("quotes").update({ state: "estimator_adjusted" }).eq("id", id);
    const { data, error } = await est
      .from("quotes")
      .update({ state: "draft" })
      .eq("id", id)
      .select("state")
      .single();
    expect(error).toBeNull();
    expect(data?.state).toBe("draft");
  });

  it("allows approve then send_to_customer by the owning rep", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    const est = actors.estimator!.client;
    await actors.rep!.client.from("quotes").update({ state: "submitted_for_review" }).eq("id", id);
    await est.from("quotes").update({ state: "under_review" }).eq("id", id);
    const approved = await est
      .from("quotes")
      .update({ state: "approved", approved_by: actors.estimator!.userId })
      .eq("id", id)
      .select("state")
      .single();
    expect(approved.error).toBeNull();

    const { data, error } = await actors.rep!.client
      .from("quotes")
      .update({ state: "sent_to_customer" })
      .eq("id", id)
      .select("state")
      .single();
    expect(error).toBeNull();
    expect(data?.state).toBe("sent_to_customer");
  });

  it("rejects reopening an accepted quote", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    const est = actors.estimator!.client;
    const rep = actors.rep!.client;
    await rep.from("quotes").update({ state: "submitted_for_review" }).eq("id", id);
    await est.from("quotes").update({ state: "under_review" }).eq("id", id);
    await est.from("quotes").update({ state: "approved" }).eq("id", id);
    await rep.from("quotes").update({ state: "sent_to_customer" }).eq("id", id);
    await rep.from("quotes").update({ state: "accepted" }).eq("id", id);
    const { error } = await rep.from("quotes").update({ state: "draft" }).eq("id", id);
    expect(error).not.toBeNull();
  });

  it("rejects an unknown state value", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    const { error } = await actors.rep!.client
      .from("quotes")
      .update({ state: "totally_invalid" as never })
      .eq("id", id);
    expect(error).not.toBeNull();
  });
});
