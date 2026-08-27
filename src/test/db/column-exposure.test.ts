import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  cleanupQuotes,
  draftPayload,
  signInAllActors,
  SKIP_REASON,
  type TestActors,
} from "./supabase-clients";

/**
 * Proves the `quotes_scoped` view actually withholds pricing columns per role.
 * Hiding them in the UI is not enough — the raw PostgREST payload is visible
 * in the browser, so the projection must be enforced by the database.
 */

let actors: TestActors;
let ready = false;
const created: string[] = [];

/** Creates a rep-owned draft and returns its id. */
async function createRepDraft(overrides: Record<string, unknown> = {}) {
  const rep = actors.rep!;
  const { data, error } = await rep.client
    .from("quotes")
    .insert(draftPayload(rep.userId, { margin_percent: 28, ...overrides }))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  created.push(data.id as string);
  return data.id as string;
}

/** Drives a rep draft all the way to `approved` through the estimator. */
async function approveQuote(id: string) {
  const rep = actors.rep!.client;
  const est = actors.estimator!.client;
  await rep.from("quotes").update({ state: "submitted_for_review" }).eq("id", id);
  await est.from("quotes").update({ state: "under_review" }).eq("id", id);
  await est
    .from("quotes")
    .update({
      state: "approved",
      margin_justification: "Above band: strategic logo",
      approved_by: actors.estimator!.userId,
    })
    .eq("id", id);
}

async function readScoped(client: TestActors["rep"], id: string) {
  const { data, error } = await client!.client
    .from("quotes_scoped")
    .select("id, margin_percent, margin_justification")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { margin_percent: number | null; margin_justification: string | null } | null;
}

beforeAll(async () => {
  actors = await signInAllActors();
  ready = actorsReady(actors);
  if (!ready) console.warn(SKIP_REASON);
});

afterAll(async () => {
  if (ready && actors.rep) await cleanupQuotes(actors.rep, created);
});

describe.runIf(process.env["VITEST_DB"] !== "0")("quotes_scoped column exposure", () => {
  it("hides both pricing columns from an external user", async () => {
    if (!ready) return;
    const external = actors.external!;
    const { data, error } = await external.client
      .from("quotes")
      .insert(draftPayload(external.userId, { owner_id: null, margin_percent: 28 }))
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = data.id as string;
    created.push(id);

    const row = await readScoped(external, id);
    expect(row).not.toBeNull();
    expect(row!.margin_percent).toBeNull();
    expect(row!.margin_justification).toBeNull();
  });

  it("hides both pricing columns from a rep on their own draft", async () => {
    if (!ready) return;
    const id = await createRepDraft();
    const row = await readScoped(actors.rep, id);
    expect(row).not.toBeNull();
    expect(row!.margin_percent).toBeNull();
    expect(row!.margin_justification).toBeNull();
  });

  it("shows margin_percent but not the justification to a rep once approved", async () => {
    if (!ready) return;
    const id = await createRepDraft();
    await approveQuote(id);

    const row = await readScoped(actors.rep, id);
    expect(row).not.toBeNull();
    expect(row!.margin_percent).not.toBeNull();
    expect(row!.margin_justification).toBeNull();
  });

  it("shows both pricing columns to an estimator", async () => {
    if (!ready) return;
    const id = await createRepDraft();
    await approveQuote(id);

    const row = await readScoped(actors.estimator, id);
    expect(row).not.toBeNull();
    expect(row!.margin_percent).not.toBeNull();
    expect(row!.margin_justification).not.toBeNull();
  });
});
