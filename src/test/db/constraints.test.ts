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
  it("rejects a margin below 10%", async () => {
    if (!ready) return;
    const { error } = await newDraft({ margin_percent: 5 });
    expect(error).not.toBeNull();
  });

  it("rejects a margin above 30%", async () => {
    if (!ready) return;
    const { error } = await newDraft({ margin_percent: 45 });
    expect(error).not.toBeNull();
  });

  it("accepts a margin inside the 10–30 band", async () => {
    if (!ready) return;
    const { error } = await newDraft({ margin_percent: 22 });
    expect(error).toBeNull();
  });

  it("requires a justification outside the 15–25 band", async () => {
    if (!ready) return;
    const { error } = await newDraft({ margin_percent: 12, margin_justification: null });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/margin_justification|violates check/i);
  });

  it("accepts an out-of-band margin with a justification", async () => {
    if (!ready) return;
    const { error } = await newDraft({
      margin_percent: 12,
      margin_justification: "Strategic displacement pricing signed off by VP Sales.",
    });
    expect(error).toBeNull();
  });

  it("rejects a negative case worker count", async () => {
    if (!ready) return;
    const { error } = await newDraft({ case_worker_count: -5 });
    expect(error).not.toBeNull();
  });

  it("accepts any positive contract length", async () => {
    if (!ready) return;
    const { error } = await newDraft({ contract_years: 4 });
    expect(error).toBeNull();
  });

  it("rejects an unknown tier value", async () => {
    if (!ready) return;
    const { error } = await newDraft({ tier: "platinum" });
    expect(error).not.toBeNull();
  });

  it("requires requested_by", async () => {
    if (!ready) return;
    const { error } = await newDraft({ requested_by: null });
    expect(error).not.toBeNull();
  });

  it("rejects an unknown notification type", async () => {
    if (!ready) return;
    const { error } = await actors.rep!.client.from("notifications").insert({
      user_id: actors.rep!.userId,
      type: "not_a_real_type",
      title: "x",
      body: "y",
    } as never);
    expect(error).not.toBeNull();
  });
});
