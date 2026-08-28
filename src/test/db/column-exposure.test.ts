import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  cleanupQuotes,
  draftPayload,
  signInAllActors,
  SKIP_REASON,
  transitionQuote,
  type TestActor,
  type TestActors,
} from "./supabase-clients";

/**
 * Proves the wire payload — not just the UI — hides pricing data.
 *
 * Every read goes through `public.quotes_scoped()`, which is SECURITY DEFINER
 * and therefore bypasses RLS: changes to the RLS policies on `public.quotes`
 * must be mirrored in the function's WHERE clause.
 */

let actors: TestActors;
let ready = false;
const created: string[] = [];

/** Reads one quote through the scoped function as the given actor. */
async function readScoped(actor: TestActor, quoteId: string) {
  const { data, error } = await actor.client
    .rpc("quotes_scoped")
    .select("id, margin_percent, margin_justification")
    .eq("id", quoteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    margin_percent: number | null;
    margin_justification: string | null;
  } | null;
}

beforeAll(async () => {
  actors = await signInAllActors();
  ready = actorsReady(actors);
  if (!ready) console.warn(SKIP_REASON);
});

afterAll(async () => {
  if (ready && actors.rep) await cleanupQuotes(actors.rep, created);
  if (ready && actors.external) await cleanupQuotes(actors.external, created);
});

describe.runIf(process.env["VITEST_DB"] !== "0")("quotes_scoped column exposure", () => {
  it("nulls pricing columns for the external requester", async () => {
    if (!ready || !actors.external) return;
    const payload = draftPayload(actors.external.userId, {
      owner_id: null,
      margin_percent: 27,
      margin_justification: "external visibility check",
    });
    const { error } = await actors.external.client.from("quotes").insert(payload);
    if (error) throw new Error(error.message);
    created.push(payload.id);

    const row = await readScoped(actors.external, payload.id);
    expect(row).not.toBeNull();
    expect(row?.margin_percent).toBeNull();
    expect(row?.margin_justification).toBeNull();
  });

  it("nulls pricing columns for a rep on their own draft", async () => {
    if (!ready || !actors.rep) return;
    const payload = draftPayload(actors.rep.userId, {
      margin_percent: 22,
      margin_justification: "draft stage check",
    });
    const { error } = await actors.rep.client.from("quotes").insert(payload);
    if (error) throw new Error(error.message);
    created.push(payload.id);

    const row = await readScoped(actors.rep, payload.id);
    expect(row).not.toBeNull();
    expect(row?.margin_percent).toBeNull();
    expect(row?.margin_justification).toBeNull();
  });

  it("shows margin_percent but not the justification to a rep once approved", async () => {
    if (!ready || !actors.rep || !actors.estimator) return;
    const payload = draftPayload(actors.rep.userId, {
      margin_percent: 20,
      margin_justification: "approved stage check",
    });
    const { error } = await actors.rep.client.from("quotes").insert(payload);
    if (error) throw new Error(error.message);
    created.push(payload.id);

    // Walk the quote to `approved` through the normal transitions.
    await actors.rep.client
      .from("quotes")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", payload.id);
    await transitionQuote(actors.rep, payload.id, "submitted_for_review");
    await transitionQuote(actors.estimator, payload.id, "under_review");
    const { error: approveError } = await transitionQuote(
      actors.estimator,
      payload.id,
      "approved",
    );
    if (approveError) throw new Error(approveError.message);

    const row = await readScoped(actors.rep, payload.id);
    expect(row).not.toBeNull();
    expect(row?.margin_percent).not.toBeNull();
    expect(row?.margin_justification).toBeNull();
  });

  it("shows both pricing columns to an estimator", async () => {
    if (!ready || !actors.rep || !actors.estimator) return;
    const payload = draftPayload(actors.rep.userId, {
      state: "submitted_for_review",
      submitted_at: new Date().toISOString(),
      margin_percent: 28,
      margin_justification: "estimator visibility check",
    });
    const { error } = await actors.rep.client.from("quotes").insert(payload);
    if (error) throw new Error(error.message);
    created.push(payload.id);

    const row = await readScoped(actors.estimator, payload.id);
    expect(row).not.toBeNull();
    expect(row?.margin_percent).not.toBeNull();
    expect(row?.margin_justification).not.toBeNull();
  });
});
