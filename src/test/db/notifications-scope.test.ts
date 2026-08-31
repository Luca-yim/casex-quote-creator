import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  actorsReady,
  cleanupQuotes,
  draftPayload,
  signInAllActors,
  SKIP_REASON,
  transitionQuote,
  type TestActors,
} from "./supabase-clients";

/**
 * Notifications must never leak across users.
 *
 * Client INSERT on `public.notifications` is revoked (verified below), and the
 * service role key is not available to the test runner, so the seed goes
 * through the only privileged writer that exists: the database trigger that
 * notifies the estimator queue when a quote is submitted for review.
 */

let actors: TestActors;
let ready = false;
const created: string[] = [];
let seededNotificationId: string | null = null;

beforeAll(async () => {
  actors = await signInAllActors();
  ready = actorsReady(actors);
  if (!ready) {
    console.warn(SKIP_REASON);
    return;
  }
  const rep = actors.rep!;
  const payload = draftPayload(rep.userId, { name: `Notification scope ${Date.now()}` });
  const { error } = await rep.client.from("quotes").insert(payload);
  if (error) throw new Error(error.message);
  created.push(payload.id);

  await rep.client
    .from("quotes")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", payload.id);
  const { error: transitionError } = await transitionQuote(rep, payload.id, "submitted_for_review");
  if (transitionError) throw new Error(transitionError.message);

  // The estimator is the notification recipient — a different user than the rep.
  const { data } = await actors
    .estimator!.client.from("notifications")
    .select("id, user_id")
    .eq("quote_id", payload.id)
    .limit(1);
  seededNotificationId = (data?.[0]?.id as string | undefined) ?? null;
});

afterAll(async () => {
  if (ready && actors.rep) await cleanupQuotes(actors.rep, created);
});

describe.runIf(process.env["VITEST_DB"] !== "0")("notifications are scoped to their owner", () => {
  it("seeds a notification owned by another user", (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    expect(seededNotificationId).not.toBeNull();
  });

  it("does not expose another user's notification to a rep", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    if (!seededNotificationId)
      return ctx.skip("seed failed: the submit-for-review trigger created no notification");
    const { data, error } = await actors
      .rep!.client.from("notifications")
      .select("id")
      .eq("id", seededNotificationId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("does not let a rep mark another user's notification as read", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    if (!seededNotificationId)
      return ctx.skip("seed failed: the submit-for-review trigger created no notification");
    await actors
      .rep!.client.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", seededNotificationId);

    const { data } = await actors
      .estimator!.client.from("notifications")
      .select("read_at")
      .eq("id", seededNotificationId)
      .maybeSingle();
    expect((data as { read_at: string | null } | null)?.read_at ?? null).toBeNull();
  });

  it("rejects client-side notification inserts", async (ctx) => {
    if (!ready) return ctx.skip(SKIP_REASON);
    const { error } = await actors.rep!.client.from("notifications").insert({
      user_id: actors.estimator!.userId,
      type: "quote_submitted",
      title: "forged",
    });
    expect(error).not.toBeNull();
  });
});
