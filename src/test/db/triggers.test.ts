import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  cleanupQuotes,
  draftPayload,
  signInAllActors,
  SKIP_REASON,
  transitionQuote,
  readQuote,
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

/** Notifications are written by a trigger — poll briefly for the row. */
async function waitForNotification(
  actorIndex: "rep" | "estimator" | "external",
  quoteId: string,
): Promise<Record<string, unknown> | null> {
  const client = actors[actorIndex]!.client;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data } = await client
      .from("notifications")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data ?? [])[0];
    if (row) return row as Record<string, unknown>;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

beforeAll(async () => {
  actors = await signInAllActors();
  ready = actorsReady(actors);
  if (!ready) console.warn(SKIP_REASON);
});

afterAll(async () => {
  if (ready && actors.rep) await cleanupQuotes(actors.rep, created);
});

describe("database triggers", () => {
  it("stamps created_at and updated_at on insert", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const id = await newDraft();
    if (!id) return ctx.skip("seed failed: could not create a draft quote");
    const data = await readQuote(actors.rep!, id, "created_at, updated_at");
    expect(data?.["created_at"]).toBeTruthy();
    expect(data?.["updated_at"]).toBeTruthy();
  });

  it("advances updated_at on every write", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const id = await newDraft();
    if (!id) return ctx.skip("seed failed: could not create a draft quote");
    const before = await readQuote(actors.rep!, id, "updated_at");
    await new Promise((r) => setTimeout(r, 1100));
    await actors.rep!.client.from("quotes").update({ name: "renamed" }).eq("id", id);
    const after = await readQuote(actors.rep!, id, "updated_at");
    expect(new Date(String(after?.["updated_at"])).getTime()).toBeGreaterThan(
      new Date(String(before?.["updated_at"])).getTime(),
    );
  });

  it("notifies on submission for review", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const id = await newDraft();
    if (!id) return ctx.skip("seed failed: could not create a draft quote");
    await actors.rep!.client
      .from("quotes")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", id);
    await transitionQuote(actors.rep!, id, "submitted_for_review");
    const note = await waitForNotification("estimator", id);
    expect(note).not.toBeNull();
  });

  it("notifies the owning rep when a quote is approved", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const id = await newDraft();
    if (!id) return ctx.skip("seed failed: could not create a draft quote");
    await transitionQuote(actors.rep!, id, "submitted_for_review");
    await transitionQuote(actors.estimator!, id, "under_review");
    await transitionQuote(actors.estimator!, id, "approved");
    const note = await waitForNotification("rep", id);
    expect(note).not.toBeNull();
    expect(String(note?.["type"])).toMatch(/approved|state/i);
  });

  it("creates notifications unread by default", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const id = await newDraft();
    if (!id) return ctx.skip("seed failed: could not create a draft quote");
    await transitionQuote(actors.rep!, id, "submitted_for_review");
    const note = await waitForNotification("estimator", id);
    if (!note) return ctx.skip("seed failed: no notification arrived for the submitted quote");
    expect(note["read_at"] ?? null).toBeNull();
  });

  it("never leaks pricing figures into an external user's notification text", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { data } = await actors.external!.client
      .from("notifications")
      .select("title, body")
      .limit(50);
    for (const row of data ?? []) {
      const text = `${(row as { title: string }).title} ${(row as { body: string }).body}`;
      expect(text).not.toMatch(/\$\s?\d/);
    }
  });

  it("lets a user mark their own notification read", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const rep = actors.rep!;
    const { data: rows } = await rep.client.from("notifications").select("id").limit(1);
    const target = (rows ?? [])[0] as { id: string } | undefined;
    if (!target) return ctx.skip("seed failed: no notification available to mark read");
    const { error } = await rep.client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", target.id);
    expect(error).toBeNull();
  });
});
