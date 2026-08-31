import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, signInAs, SKIP_REASON, type TestActor } from "./supabase-clients";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side enforcement of the Lead Queue's action gating.
 *
 * `src/features/leads/__tests__/LeadRowActions.test.tsx` proves the UI hides
 * the actions. This suite proves the DATABASE rejects them, by talking to
 * supabase-js directly and bypassing the UI entirely — the only test that can
 * distinguish a convention from a guarantee.
 */

let rep: TestActor | null = null;
let estimator: TestActor | null = null;
let admin: TestActor | null = null;

/** The anonymous submitter session — the only role allowed to create leads. */
let anonSubmitter: { client: SupabaseClient; userId: string } | null = null;

/** Leads created by this suite, cleaned up at the end. */
const createdLeadIds: string[] = [];

/**
 * Columns the anonymous insert policy deliberately discards (see
 * `anon-lead-intake-full.probe.mts` step 2c). A submitter can never set these,
 * so a test needing a pre-claimed lead must have an internal actor apply them
 * in a second step.
 */
const INTERNAL_COLUMNS = new Set([
  "status",
  "lead_score",
  "confidence_pct",
  "claimed_by",
  "claimed_at",
  "assigned_rep_id",
  "converted_quote_id",
  "duplicate_of_lead_id",
]);

/** Signs in the anonymous submitter once, exactly as `/get-a-quote` does. */
async function initAnonSubmitter(): Promise<void> {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    console.error(
      `[seedLead] signInAnonymously failed — message=${error?.message ?? "no user returned"}`,
    );
    return;
  }
  anonSubmitter = { client, userId: data.user.id };
}

function leadRow(anonId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    submitted_by_anon_id: anonId,
    organization_name: `RLS probe ${Date.now()}`,
    contact_name: "Probe Contact",
    contact_email: `probe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    ...overrides,
  };
}

/**
 * Seeds a lead through the real submission path: an anonymous session
 * inserting its own row, matching `submitter_creates_own_lead`'s WITH CHECK.
 * Internal-workflow overrides are applied afterwards by a privileged actor,
 * because the insert policy strips them.
 */
async function seedLead(overrides: Record<string, unknown> = {}): Promise<string | null> {
  if (!anonSubmitter) {
    console.error("[seedLead] no anonymous submitter session available");
    return null;
  }

  const submitterOverrides: Record<string, unknown> = {};
  const internalOverrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (INTERNAL_COLUMNS.has(key)) internalOverrides[key] = value;
    else submitterOverrides[key] = value;
  }

  const row = leadRow(anonSubmitter.userId, submitterOverrides);
  const { error } = await anonSubmitter.client.from("lead_intakes").insert(row as never);
  if (error) {
    console.error(
      `[seedLead] anonymous insert into lead_intakes rejected — ` +
        `code=${error.code ?? "none"} message=${error.message} ` +
        `details=${error.details ?? "none"} hint=${error.hint ?? "none"}`,
    );
    return null;
  }
  createdLeadIds.push(row.id);

  if (Object.keys(internalOverrides).length > 0) {
    const escalator = admin ?? estimator;
    if (!escalator) {
      console.error(
        `[seedLead] internal overrides ${Object.keys(internalOverrides).join(", ")} ` +
          `require an admin or estimator actor; none available`,
      );
      return null;
    }
    const { error: updateError } = await escalator.client
      .from("lead_intakes")
      .update(internalOverrides as never)
      .eq("id", row.id);
    if (updateError) {
      console.error(
        `[seedLead] internal override update rejected for role="${escalator.role}" ` +
          `code=${updateError.code ?? "none"} message=${updateError.message} ` +
          `details=${updateError.details ?? "none"} hint=${updateError.hint ?? "none"}`,
      );
      return null;
    }
  }

  return row.id;
}


/** Reads back the columns this suite asserts on, as an unrestricted reader. */
async function readLead(id: string): Promise<Record<string, unknown> | null> {
  const reader = admin ?? estimator;
  if (!reader) return null;
  const { data } = await reader.client
    .from("lead_intakes")
    .select("id, status, assigned_rep_id, claimed_by, claimed_at, duplicate_of_lead_id")
    .eq("id", id)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * True when the write was genuinely refused: either the policy raised an
 * error, or it filtered the row so nothing changed. A silent success that
 * mutates the row is the security failure this suite exists to catch.
 */
function wasRejected(
  error: { message: string } | null,
  before: unknown,
  after: unknown,
): boolean {
  return error !== null || JSON.stringify(before) === JSON.stringify(after);
}

beforeAll(async () => {
  [rep, estimator, admin] = await Promise.all([
    signInAs("rep"),
    signInAs("estimator"),
    signInAs("admin"),
  ]);
  if (!rep || !estimator) console.warn(SKIP_REASON);
  if (!admin) {
    console.warn(
      "Admin persona missing — sessions are minted with the Auth Admin API " +
        "(no password). Set TEST_USER_ADMIN_EMAIL and E2E_SUPABASE_SERVICE_ROLE_KEY " +
        "to run the reassignment case.",
    );
  }
});

afterAll(async () => {
  const cleaner = admin ?? estimator;
  if (!cleaner || createdLeadIds.length === 0) return;
  await cleaner.client.from("lead_intakes").delete().in("id", createdLeadIds);
});

describe.runIf(process.env["VITEST_DB"] !== "0")("lead_intakes update permissions", () => {
  it("blocks a sales rep from assigning a lead to somebody else", async (ctx) => {
    if (!rep || !estimator) return ctx.skip();
    const leadId = await seedLead();
    if (!leadId) return ctx.skip();

    const before = await readLead(leadId);

    // Straight to the REST API — no UI gating in the way.
    const { error } = await rep.client
      .from("lead_intakes")
      .update({ assigned_rep_id: estimator.userId } as never)
      .eq("id", leadId);

    const after = await readLead(leadId);
    expect(wasRejected(error, before, after)).toBe(true);
    expect((after as { assigned_rep_id?: string | null } | null)?.assigned_rep_id).not.toBe(
      estimator.userId,
    );
  });

  it("blocks a sales rep from marking a lead as duplicate", async (ctx) => {
    if (!rep) return ctx.skip();
    const original = await seedLead();
    const leadId = await seedLead();
    if (!original || !leadId) return ctx.skip();

    const before = await readLead(leadId);

    const { error } = await rep.client
      .from("lead_intakes")
      .update({ status: "duplicate", duplicate_of_lead_id: original } as never)
      .eq("id", leadId);

    const after = await readLead(leadId);
    expect(wasRejected(error, before, after)).toBe(true);
    expect((after as { status?: string } | null)?.status).not.toBe("duplicate");
  });

  it("allows a sales rep to perform the legitimate self-targeted atomic claim", async (ctx) => {
    if (!rep) return ctx.skip();
    const leadId = await seedLead();
    if (!leadId) return ctx.skip();

    const claimedAt = new Date().toISOString();
    // Exactly the payload useLeadActions.claim sends: all four fields at once.
    const { error } = await rep.client
      .from("lead_intakes")
      .update({
        claimed_by: rep.userId,
        claimed_at: claimedAt,
        assigned_rep_id: rep.userId,
        status: "claimed",
      } as never)
      .eq("id", leadId);

    expect(error).toBeNull();

    const after = await readLead(leadId);
    expect(after).toMatchObject({
      status: "claimed",
      assigned_rep_id: rep.userId,
      claimed_by: rep.userId,
    });
    expect(after?.["claimed_at"]).not.toBeNull();
  });

  it("allows an estimator to mark a lead as duplicate", async (ctx) => {
    if (!estimator) return ctx.skip();
    const original = await seedLead();
    const leadId = await seedLead();
    if (!original || !leadId) return ctx.skip();

    const { error } = await estimator.client
      .from("lead_intakes")
      .update({ status: "duplicate", duplicate_of_lead_id: original } as never)
      .eq("id", leadId);

    expect(error).toBeNull();

    const after = await readLead(leadId);
    expect(after).toMatchObject({ status: "duplicate", duplicate_of_lead_id: original });
  });

  it("allows an admin to reassign a lead to a different rep", async (ctx) => {
    if (!admin || !rep || !estimator) return ctx.skip();
    const leadId = await seedLead({
      assigned_rep_id: rep.userId,
      claimed_by: rep.userId,
      claimed_at: new Date().toISOString(),
      status: "claimed",
    });
    if (!leadId) return ctx.skip();

    const { error } = await admin.client
      .from("lead_intakes")
      .update({ assigned_rep_id: estimator.userId } as never)
      .eq("id", leadId);

    expect(error).toBeNull();

    const after = await readLead(leadId);
    expect(after?.["assigned_rep_id"]).toBe(estimator.userId);
    // Reassignment is ownership, not history: the claim trail is preserved.
    expect(after?.["claimed_by"]).toBe(rep.userId);
  });
});
