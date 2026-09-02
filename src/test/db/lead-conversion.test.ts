import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mintDisposableSubmitter, signInAs, SKIP_REASON, type TestActor } from "./supabase-clients";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side proof of the lead -> ballpark quote conversion.
 *
 * Everything here runs against real, RLS-scoped sessions minted through the
 * Auth Admin API (never the CAPTCHA-gated public endpoints), so the suite
 * exercises `convert_lead_to_quote()` exactly as the Lead Queue calls it.
 */

let rep: TestActor | null = null;
let estimator: TestActor | null = null;
let admin: TestActor | null = null;

/** The anonymous submitter session — the only role allowed to create leads. */
let anonSubmitter: { client: SupabaseClient; userId: string } | null = null;

const createdLeadIds: string[] = [];
const createdQuoteIds: string[] = [];

/**
 * Columns the anonymous insert policy discards (see lead-permissions.test.ts).
 * A test needing a qualified lead must have an internal actor apply them in a
 * second, privileged step — the escalation path the estimator really uses.
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

function leadRow(anonId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    submitted_by_anon_id: anonId,
    organization_name: `Conversion probe ${Date.now()}`,
    contact_name: "Probe Contact",
    contact_email: `convert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    ...overrides,
  };
}

/** Anonymous insert first, privileged update for internal-workflow columns. */
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
      `[seedLead] anonymous insert rejected — code=${error.code ?? "none"} ` +
        `message=${error.message} details=${error.details ?? "none"}`,
    );
    return null;
  }
  createdLeadIds.push(row.id);

  if (Object.keys(internalOverrides).length > 0) {
    const escalator = admin ?? estimator;
    if (!escalator) {
      console.error("[seedLead] internal overrides need an admin or estimator actor");
      return null;
    }
    const { error: updateError } = await escalator.client
      .from("lead_intakes")
      .update(internalOverrides as never)
      .eq("id", row.id);
    if (updateError) {
      console.error(
        `[seedLead] internal override update rejected for role="${escalator.role}" — ` +
          `code=${updateError.code ?? "none"} message=${updateError.message}`,
      );
      return null;
    }
  }

  return row.id;
}

/**
 * A claimed lead with exact integer counts, plus one compliance value the
 * quote vocabulary has no counterpart for ("none") next to a mappable one.
 *
 * Conversion requires status = 'claimed' (the "qualified"/"unqualified"
 * statuses were retired from the gate — see enforce_lead_intake_update_rules
 * and convert_lead_to_quote for the current rule).
 */
function claimedLeadFields(claimedBy: string) {
  return {
    internal_user_count: 1,
    external_portal_monthly_logins: 25000,
    b2b_user_count: 100,
    integration_count: 2,
    compliance_requirements: ["soc2", "none"],
    status: "claimed",
    claimed_by: claimedBy,
    claimed_at: new Date().toISOString(),
    assigned_rep_id: claimedBy,
  };
}

/** Reads a lead through the exact columns/table `useLeadQueue` reads. */
async function readLead(id: string): Promise<Record<string, unknown> | null> {
  const reader = admin ?? estimator;
  if (!reader) return null;
  const { data } = await reader.client.from("lead_intakes").select("*").eq("id", id).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Reads the new quote as the rep who performed the conversion — the actual
 * converter/requested_by in this flow, and the persona whose visibility
 * `quotes_scoped()` grants for their own quotes.
 */
async function readQuoteRow(quoteId: string): Promise<Record<string, unknown> | null> {
  const reader = rep;
  if (!reader) return null;

  const { data, error } = await reader.client.rpc("quotes_scoped").select("*").eq("id", quoteId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

/** Latest quote_versions row for a quote, read the same way the UI does. */
async function readLatestVersion(quoteId: string): Promise<Record<string, unknown> | null> {
  const reader = rep;
  if (!reader) return null;
  const { data, error } = await reader.client
    .rpc("quote_versions_scoped")
    .select("*")
    .eq("quote_id", quoteId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * `convert_lead_to_quote` is declared `returns public.quotes`, so a successful
 * call always yields a single composite row object with a string `id`. Any
 * other shape is a contract violation and must fail loudly.
 */
function quoteIdFrom(data: unknown): string {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof (data as Record<string, unknown>)["id"] !== "string"
  ) {
    throw new Error(`convert_lead_to_quote returned an unexpected shape: ${JSON.stringify(data)}`);
  }
  return (data as Record<string, unknown>)["id"] as string;
}

async function convert(
  actor: TestActor,
  leadId: string,
): Promise<{ quoteId: string | null; error: { message: string; code?: string } | null }> {
  const { data, error } = await actor.client.rpc("convert_lead_to_quote", {
    p_lead_id: leadId,
  });
  // A genuine PostgREST error stays a reported error (the rejection tests rely
  // on it); only a *successful* call with a malformed payload throws.
  if (error) {
    return { quoteId: null, error: { message: error.message, code: error.code } };
  }
  const quoteId = quoteIdFrom(data);
  createdQuoteIds.push(quoteId);
  return { quoteId, error: null };
}

beforeAll(async () => {
  [rep, estimator, admin] = await Promise.all([signInAs("rep"), signInAs("estimator"), signInAs("admin")]);
  anonSubmitter = await mintDisposableSubmitter();
  if (!rep || !estimator || !anonSubmitter) console.warn(SKIP_REASON);
});

afterAll(async () => {
  const cleaner = admin ?? estimator;
  if (!cleaner) return;
  if (createdQuoteIds.length > 0) {
    await cleaner.client.from("quotes").delete().in("id", createdQuoteIds);
  }
  if (createdLeadIds.length > 0) {
    await cleaner.client.from("lead_intakes").delete().in("id", createdLeadIds);
  }
});

describe.runIf(process.env["VITEST_DB"] !== "0")("convert_lead_to_quote", () => {
  it("creates a ballpark draft from a claimed lead and marks the lead converted", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead(claimedLeadFields(rep.userId));
    if (!leadId) return ctx.skip();

    const seeded = await readLead(leadId);
    console.log("[lead-conversion] seeded lead row before convert:", JSON.stringify(seeded, null, 2));

    const { quoteId, error } = await convert(rep, leadId);

    expect(error).toBeNull();
    expect(quoteId).toBeTruthy();

    const quote = await readQuoteRow(quoteId as string);
    expect(quote).not.toBeNull();

    // Exact integer carried through unchanged — no band derivation anymore.
    expect(quote?.["case_worker_count"]).toBe(1);

    const compliance = (quote?.["compliance"] ?? []) as string[];
    expect(compliance).toContain("soc2_type2");
    expect(compliance).not.toContain("none");

    expect(quote?.["lead_id"]).toBe(leadId);
    expect(quote?.["tier"]).toBe("ballpark");
    expect(quote?.["state"]).toBe("draft");

    // The dropped, unmappable compliance code is recorded in the conversion's
    // audit trail entry rather than a dedicated notes column.
    const version = await readLatestVersion(quoteId as string);
    expect(String(version?.["change_reason"] ?? "")).toMatch(/none/i);

    // The lead, read back the way useLeadQueue reads it.
    const lead = await readLead(leadId);
    expect(lead?.["status"]).toBe("converted_to_ballpark");
    expect(lead?.["converted_quote_id"]).toBe(quoteId);
  });

  it("writes exactly one convert snapshot for the new quote", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead(claimedLeadFields(rep.userId));
    if (!leadId) return ctx.skip();

    const { quoteId, error } = await convert(rep, leadId);
    expect(error).toBeNull();
    expect(quoteId).toBeTruthy();

    const { data, error: readError } = await rep.client
      .rpc("quote_versions_scoped")
      .select("*")
      .eq("quote_id", quoteId as string)
      .order("version_number", { ascending: true });
    if (readError) throw new Error(readError.message);

    const versions = (data ?? []) as unknown as Array<{
      version_number: number;
      snapshot: Record<string, unknown>;
    }>;
    expect(versions).toHaveLength(1);
    expect(versions[0]?.version_number).toBe(1);
    expect(versions[0]?.snapshot?.["__changeType"]).toBe("convert");
  });

  it("rejects a second conversion of the same lead", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead(claimedLeadFields(rep.userId));
    if (!leadId) return ctx.skip();

    const first = await convert(rep, leadId);
    expect(first.error).toBeNull();

    const second = await convert(rep, leadId);
    expect(second.error).not.toBeNull();
    expect(second.quoteId).toBeNull();
    expect(second.error?.message).toMatch(/already|converted/i);

    // The original link is untouched.
    const lead = await readLead(leadId);
    expect(lead?.["converted_quote_id"]).toBe(first.quoteId);
  });

  it("rejects conversion of a lead that is not claimed", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead({ status: "new_lead" });
    if (!leadId) return ctx.skip();

    const { quoteId, error } = await convert(rep, leadId);
    expect(error).not.toBeNull();
    expect(quoteId).toBeNull();
    expect(error?.message).toMatch(/claim/i);

    const lead = await readLead(leadId);
    expect(lead?.["status"]).toBe("new_lead");
    expect(lead?.["converted_quote_id"]).toBeNull();
  });
});

describe.runIf(process.env["VITEST_DB"] !== "0")("estimator_assign_and_convert", () => {
  it("atomically assigns, claims, and converts an unclaimed lead to the named rep", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead({
      internal_user_count: 5,
      compliance_requirements: ["hipaa"],
      status: "new_lead",
    });
    if (!leadId) return ctx.skip();

    const { data, error } = await estimator.client.rpc("estimator_assign_and_convert", {
      p_lead_id: leadId,
      p_rep_id: rep.userId,
    });
    expect(error).toBeNull();
    const quoteId = quoteIdFrom(data);
    createdQuoteIds.push(quoteId);

    const lead = await readLead(leadId);
    expect(lead?.["status"]).toBe("converted_to_ballpark");
    expect(lead?.["claimed_by"]).toBe(rep.userId);
    expect(lead?.["assigned_rep_id"]).toBe(rep.userId);
    expect(lead?.["converted_quote_id"]).toBe(quoteId);

    // The quote must be visible to the rep as a draft — requires
    // requested_by (not just owner_id) to be the rep, per quotes_scoped()'s
    // draft-visibility rule.
    const quote = await readQuoteRow(quoteId);
    expect(quote).not.toBeNull();
    expect(quote?.["needs_attention"]).toBe(true);
  });

  it("rejects assign-and-convert on an already-claimed lead", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead(claimedLeadFields(rep.userId));
    if (!leadId) return ctx.skip();

    const { data, error } = await estimator.client.rpc("estimator_assign_and_convert", {
      p_lead_id: leadId,
      p_rep_id: rep.userId,
    });
    expect(error).not.toBeNull();
    expect(data).toBeFalsy();
  });

  it("rejects assign-and-convert from a non-estimator caller", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead({ status: "new_lead" });
    if (!leadId) return ctx.skip();

    const { data, error } = await rep.client.rpc("estimator_assign_and_convert", {
      p_lead_id: leadId,
      p_rep_id: rep.userId,
    });
    expect(error).not.toBeNull();
    expect(data).toBeFalsy();
  });
});
