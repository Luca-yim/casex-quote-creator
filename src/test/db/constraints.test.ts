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

async function newDraft(overrides: Record<string, unknown> = {}) {
  const rep = actors.rep!;
  // Client-generated id: the insert cannot read its row back, because
  // `authenticated` has no SELECT on `public.quotes`.
  const payload = draftPayload(rep.userId, overrides);
  const result = await rep.client.from("quotes").insert(payload);
  if (!result.error) created.push(payload.id);
  return result;
}

beforeAll(async () => {
  actors = await signInAllActors();
  ready = actorsReady(actors);
  if (!ready) console.warn(SKIP_REASON);
});

afterAll(async () => {
  if (ready && actors.rep) await cleanupQuotes(actors.rep, created);
});

describe("check constraints", () => {
  it("rejects a margin below 0%", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await newDraft({ margin_percent: -5 });
    expect(error).not.toBeNull();
  });

  it("rejects a margin above 100%", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await newDraft({ margin_percent: 105 });
    expect(error).not.toBeNull();
  });

  it("accepts any margin within 0–100%", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await newDraft({ margin_percent: 45 });
    expect(error).toBeNull();
  });

  it("accepts a margin at the 0% and 100% boundaries", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error: low } = await newDraft({ margin_percent: 0 });
    expect(low).toBeNull();
    const { error: high } = await newDraft({ margin_percent: 100 });
    expect(high).toBeNull();
  });

  it("does not require margin_justification for any valid margin", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await newDraft({
      margin_percent: 45,
      margin_justification: null,
    });
    expect(error).toBeNull();
  });

  it("rejects a negative case worker count", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await newDraft({ case_worker_count: -5 });
    expect(error).not.toBeNull();
  });

  it("accepts any positive contract length", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await newDraft({ contract_years: 4 });
    expect(error).toBeNull();
  });

  it("rejects an unknown tier value", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await newDraft({ tier: "platinum" });
    expect(error).not.toBeNull();
  });

  it("requires requested_by", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await newDraft({ requested_by: null });
    expect(error).not.toBeNull();
  });

  it("rejects an unknown notification type", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await actors.rep!.client.from("notifications").insert({
      user_id: actors.rep!.userId,
      type: "not_a_real_type",
      title: "x",
      body: "y",
    } as never);
    expect(error).not.toBeNull();
  });
});
