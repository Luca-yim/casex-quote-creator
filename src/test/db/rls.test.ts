import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  anonClient,
  cleanupQuotes,
  draftPayload,
  readQuote,
  signInAllActors,
  SKIP_REASON,
  type TestActors,
} from "./supabase-clients";

let actors: TestActors;
let ready = false;
const created: string[] = [];

beforeAll(async () => {
  actors = await signInAllActors();
  ready = actorsReady(actors);
  if (!ready) console.warn(SKIP_REASON);
});

afterAll(async () => {
  if (ready && actors.rep) await cleanupQuotes(actors.rep, created);
});

describe.runIf(process.env["VITEST_DB"] !== "0")("row level security", () => {
  it("denies anonymous reads of quotes", async () => {
    if (!ready) return;
    const { data, error } = await anonClient().from("quotes").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("denies anonymous reads of profiles", async () => {
    if (!ready) return;
    const { data, error } = await anonClient().from("profiles").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("lets any authenticated user read the pricing catalog", async () => {
    if (!ready) return;
    const { data, error } = await actors.rep!.client
      .from("pricing_catalog")
      .select("sku_id")
      .limit(5);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("hides the catalog from anonymous callers", async () => {
    if (!ready) return;
    const { data, error } = await anonClient().from("pricing_catalog").select("sku_id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("lets a rep create their own draft", async () => {
    if (!ready) return;
    const rep = actors.rep!;
    const payload = draftPayload(rep.userId);
    const { error } = await rep.client.from("quotes").insert(payload);
    expect(error).toBeNull();
    if (!error) created.push(payload.id);
    const row = await readQuote(rep, payload.id, "id, state, owner_id");
    expect(row?.["state"]).toBe("draft");
  });

  it("rejects a rep creating a quote owned by someone else", async () => {
    if (!ready) return;
    const rep = actors.rep!;
    const other = actors.estimator!.userId;
    const payload = draftPayload(rep.userId, { requested_by: other, owner_id: other });
    const { error } = await rep.client.from("quotes").insert(payload);
    if (!error) created.push(payload.id);
    expect(error).not.toBeNull();
  });

  it("hides another user's draft from an external user", async () => {
    if (!ready) return;
    const repQuote = created[0];
    if (!repQuote) return;
    const data = await readQuote(actors.external!, repQuote, "id");
    expect(data).toBeNull();
  });

  it("lets an estimator read quotes they do not own", async () => {
    if (!ready) return;
    const { error } = await actors.estimator!.client
      .rpc("quotes_scoped")
      .select("id")
      .limit(5);
    expect(error).toBeNull();
  });

  it("blocks an external user from updating a rep's quote", async () => {
    if (!ready) return;
    const repQuote = created[0];
    if (!repQuote) return;
    const { data, error } = await actors.external!.client
      .from("quotes")
      .update({ name: "hijacked" })
      .eq("id", repQuote)
      .select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("only returns a user's own notifications", async () => {
    if (!ready) return;
    const rep = actors.rep!;
    const { data, error } = await rep.client.from("notifications").select("user_id").limit(50);
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect((row as { user_id: string }).user_id).toBe(rep.userId);
    }
  });

  it("blocks anonymous access to notifications", async () => {
    if (!ready) return;
    const { data, error } = await anonClient().from("notifications").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("prevents a rep from writing another user's notification", async () => {
    if (!ready) return;
    const { error } = await actors.rep!.client.from("notifications").insert({
      user_id: actors.estimator!.userId,
      type: "quote_submitted",
      title: "spoof",
      body: "spoof",
    } as never);
    expect(error).not.toBeNull();
  });
});
