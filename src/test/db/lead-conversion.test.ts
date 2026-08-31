import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  mintDisposableSubmitter,
  signInAs,
  SKIP_REASON,
  type TestActor,
} from "./supabase-clients";
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
 * A lead with real band strings taken verbatim from
 * `src/features/lead-intake/lead-intake-options.ts`, plus one compliance value
 * the quote vocabulary has no counterpart for ("none") next to a mappable one.
 */
function qualifiedLeadFields() {
  return {
    internal_user_range: "1-50",
    external_portal_monthly_logins_range: "10k-50k",
    b2b_user_count_range: "1-100",
    integration_count_range: "1-2",
    compliance_requirements: ["soc2", "none"],
    status: "qualified",
  };
}

/** Reads a lead through the exact columns/table `useLeadQueue` reads. */
async function readLead(id: string): Promise<Record<string, unknown> | null> {
  const reader = admin ?? estimator;
  if (!reader) return null;
  const { data } = await reader.client
    .from("lead_intakes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
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

  const { data, error } = await reader.client
    .rpc("quotes_scoped")
    .select("*")
    .eq("id", quoteId)
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
    throw new Error(
      `convert_lead_to_quote returned an unexpected shape: ${JSON.stringify(data)}`,
    );
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
  [rep, estimator, admin] = await Promise.all([
    signInAs("rep"),
    signInAs("estimator"),
    signInAs("admin"),
  ]);
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
  it("creates a ballpark draft from a qualified lead and marks the lead converted", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead(qualifiedLeadFields());
    if (!leadId) return ctx.skip();

    const { quoteId, error } = await convert(rep, leadId);
    expect(error).toBeNull();
    expect(quoteId).toBeTruthy();

    const quote = await readQuoteRow(quoteId as string);
    expect(quote).not.toBeNull();

    // "1-50" -> band floor.
    expect(quote?.["case_worker_count"]).toBe(1);

    const compliance = (quote?.["compliance"] ?? []) as string[];
    expect(compliance).toContain("soc2_type2");
    expect(compliance).not.toContain("none");

    const notes = String(quote?.["converted_from_lead_notes"] ?? "");
    expect(notes).toMatch(/1-50/); // band-derivation note
    expect(notes).toMatch(/none/); // unmapped-compliance note

    expect(quote?.["converted_from_lead_id"]).toBe(leadId);
    expect(quote?.["tier"]).toBe("ballpark");
    expect(quote?.["state"]).toBe("draft");

    // The lead, read back the way useLeadQueue reads it.
    const lead = await readLead(leadId);
    expect(lead?.["status"]).toBe("converted_to_ballpark");
    expect(lead?.["converted_quote_id"]).toBe(quoteId);
  });

  it("writes exactly one convert snapshot for the new quote", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead(qualifiedLeadFields());
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
    const leadId = await seedLead(qualifiedLeadFields());
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

  it("rejects conversion of a lead that is not qualified", async (ctx) => {
    if (!rep || !estimator || !anonSubmitter) return ctx.skip(SKIP_REASON);
    const leadId = await seedLead({ ...qualifiedLeadFields(), status: "new_lead" });
    if (!leadId) return ctx.skip();

    const { quoteId, error } = await convert(rep, leadId);
    expect(error).not.toBeNull();
    expect(quoteId).toBeNull();
    expect(error?.message).toMatch(/qualif/i);

    const lead = await readLead(leadId);
    expect(lead?.["status"]).toBe("new_lead");
    expect(lead?.["converted_quote_id"]).toBeNull();
  });
});
