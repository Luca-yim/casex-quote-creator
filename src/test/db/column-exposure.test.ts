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

/** Reads a quote's audit-trail snapshots through the role-scoped function. */
async function readScopedVersions(actor: TestActor, quoteId: string) {
  const { data, error } = await actor.client
    .rpc("quote_versions_scoped")
    .select("*")
    .eq("quote_id", quoteId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Array<{ snapshot: Record<string, unknown> }>;
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
  it("nulls pricing columns for the external requester", async (ctx) => {
    if (!ready || !actors.external) return ctx.skip(SKIP_REASON);
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

  it("nulls pricing columns for a rep on their own draft", async (ctx) => {
    if (!ready || !actors.rep) return ctx.skip(SKIP_REASON);
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

  it("shows margin_percent but not the justification to a rep once approved", async (ctx) => {
    if (!ready || !actors.rep || !actors.estimator) return ctx.skip(SKIP_REASON);
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

  it("shows both pricing columns to an estimator", async (ctx) => {
    if (!ready || !actors.rep || !actors.estimator) return ctx.skip(SKIP_REASON);
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

describe.runIf(process.env["VITEST_DB"] !== "0")("quote_versions_scoped snapshot exposure", () => {
  it("strips pricing keys from a rep's snapshot but keeps them for an estimator", async (ctx) => {
    if (!ready || !actors.rep || !actors.estimator) return ctx.skip(SKIP_REASON);
    const payload = draftPayload(actors.rep.userId, {
      margin_percent: 24,
      margin_justification: "snapshot visibility check",
    });
    const { error } = await actors.rep.client.from("quotes").insert(payload);
    if (error) throw new Error(error.message);
    created.push(payload.id);

    const snapshot = {
      id: payload.id,
      name: "snapshot visibility check",
      margin_percent: 24,
      margin_justification: "why the margin is 24",
    };
    const { error: versionError } = await actors.rep.client.from("quote_versions").insert({
      id: crypto.randomUUID(),
      quote_id: payload.id,
      version_number: 1,
      snapshot,
      change_reason: "column exposure check",
      changed_by: actors.rep.userId,
    });
    if (versionError) throw new Error(versionError.message);

    // Rep, on their own draft: pricing keys must be gone.
    const repRows = await readScopedVersions(actors.rep, payload.id);
    expect(repRows).toHaveLength(1);
    const repSnapshot = repRows[0]?.snapshot ?? {};
    expect(Object.keys(repSnapshot)).not.toContain("margin_percent");
    expect(Object.keys(repSnapshot)).not.toContain("margin_justification");

    // Same version, estimator: both keys present once it reaches their queue.
    await actors.rep.client
      .from("quotes")
      .update({ submitted_at: new Date().toISOString() })
      .eq("id", payload.id);
    const { error: transitionError } = await transitionQuote(
      actors.rep,
      payload.id,
      "submitted_for_review",
    );
    if (transitionError) throw new Error(transitionError.message);

    const estimatorRows = await readScopedVersions(actors.estimator, payload.id);
    expect(estimatorRows).toHaveLength(1);
    const estimatorSnapshot = estimatorRows[0]?.snapshot ?? {};
    expect(Object.keys(estimatorSnapshot)).toContain("margin_percent");
    expect(Object.keys(estimatorSnapshot)).toContain("margin_justification");
  });
});
