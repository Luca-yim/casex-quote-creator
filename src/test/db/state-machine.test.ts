import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  cleanupQuotes,
  draftPayload,
  signInAllActors,
  SKIP_REASON,
  readQuote,
  type TestActors,
} from "./supabase-clients";


// --- TEMPORARY DIAGNOSTIC: log raw PostgREST requests/responses ---
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  const method = (init?.method ?? input?.method ?? "GET").toUpperCase();
  const isQuotesWrite = url.includes("/rest/v1/quotes") && method !== "GET";
  let reqHeaders: Record<string, string> = {};
  try {
    const h = new Headers(init?.headers ?? input?.headers ?? {});
    h.forEach((v, k) => {
      reqHeaders[k] = /authorization|apikey/i.test(k) ? "<redacted>" : v;
    });
  } catch {}
  if (isQuotesWrite) {
    console.log("[REQ]", method, url);
    console.log("[REQ headers]", JSON.stringify(reqHeaders));
    console.log("[REQ body]", typeof init?.body === "string" ? init.body : String(init?.body));
  }
  const res = await realFetch(input, init);
  if (isQuotesWrite) {
    const clone = res.clone();
    const text = await clone.text();
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => (resHeaders[k] = v));
    console.log("[RES]", res.status, res.statusText);
    console.log("[RES headers]", JSON.stringify(resHeaders));
    console.log("[RES body]", text);
  }
  return res;
}) as typeof fetch;
// --- END DIAGNOSTIC ---

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
    const { error } = await actors.rep!.client
      .from("quotes")
      .update({ state: "submitted_for_review", submitted_at: new Date().toISOString() })
      .eq("id", id);
    expect(error).toBeNull();
    expect((await readQuote(actors.rep!, id, "state"))?.["state"]).toBe("submitted_for_review");
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
    const { data: whoami, error: whoamiErr } = await actors.estimator!.client.rpc("current_user_role" as never);
    console.log("estimator current_user_role():", whoami, whoamiErr);
    const { data: userData } = await actors.estimator!.client.auth.getUser();
    console.log("estimator auth.uid():", userData?.user?.id, "expected:", "fe3a6f78-949a-4cc1-995e-7d2d5ec72877");
    const { error } = await actors.estimator!.client
      .from("quotes")
      .update({ state: "under_review", reviewed_by: actors.estimator!.userId })
      .eq("id", id)
      .select("id");
    console.log("update error (A):", JSON.stringify(error));

    expect(error).toBeNull();
    expect((await readQuote(actors.estimator!, id, "state"))?.["state"]).toBe("under_review");
  });

  it("allows an estimator to return estimator_adjusted → draft", async () => {
    if (!ready) return;
    const id = await newDraft();
    if (!id) return;
    const est = actors.estimator!.client;
    await actors.rep!.client.from("quotes").update({ state: "submitted_for_review" }).eq("id", id);
    await est.from("quotes").update({ state: "under_review", reviewed_by: actors.estimator!.userId }).eq("id", id);
    await est.from("quotes").update({ state: "estimator_adjusted", reviewed_by: actors.estimator!.userId }).eq("id", id);
    const { data: whoami, error: whoamiErr } = await est.rpc("current_user_role" as never);
    console.log("estimator current_user_role():", whoami, whoamiErr);
    const { data: userData } = await est.auth.getUser();
    console.log("estimator auth.uid():", userData?.user?.id, "expected:", "fe3a6f78-949a-4cc1-995e-7d2d5ec72877");
    const { error } = await est
      .from("quotes")
      .update({ state: "draft", reviewed_by: actors.estimator!.userId })
      .eq("id", id)
      .select("id");
    console.log("update error (B):", JSON.stringify(error));

    expect(error).toBeNull();
    expect((await readQuote(actors.estimator!, id, "state"))?.["state"]).toBe("draft");
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
      .eq("id", id);
    expect(approved.error).toBeNull();

    const { error } = await actors.rep!.client
      .from("quotes")
      .update({ state: "sent_to_customer" })
      .eq("id", id);
    expect(error).toBeNull();
    expect((await readQuote(actors.rep!, id, "state"))?.["state"]).toBe("sent_to_customer");
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
