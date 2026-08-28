/**
 * Throwaway probe: full-column anonymous lead_intakes insert + read-back.
 *
 * Run with: bun src/test/db/anon-lead-intake-full.probe.mts
 */
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env.test.local", override: true });

const URL = process.env["VITE_APP_SUPABASE_URL"] ?? "";
const KEY = process.env["VITE_APP_SUPABASE_PUBLISHABLE_KEY"] ?? "";

function client(): SupabaseClient {
  return createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function describe(value: unknown): string {
  if (value === null) return "null (null)";
  if (Array.isArray(value)) return `${JSON.stringify(value)} (array[${value.length}] of ${[...new Set(value.map((v) => typeof v))].join("|") || "-"})`;
  return `${JSON.stringify(value)} (${typeof value})`;
}

function printRow(label: string, row: Record<string, unknown>) {
  console.log(`\n--- ${label} ---`);
  for (const key of Object.keys(row).sort()) {
    console.log(`  ${key.padEnd(36)} = ${describe(row[key])}`);
  }
}

function payload(anonId: string, extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    submitted_by_anon_id: anonId,
    organization_name: "Probe Co",
    contact_name: "Probe Contact",
    contact_email: `probe+${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
    vertical: "government",
    solution: "case-management",
    internal_user_range: "51-200",
    external_portal_required: true,
    external_portal_monthly_logins_range: "10k-50k",
    b2b_portal_required: true,
    b2b_user_count_range: "101-500",
    hosting_preference: "cloud",
    compliance_requirements: ["soc2", "hipaa"],
    integration_required: true,
    integration_count_range: "3-5",
    integration_difficulty: "medium",
    additional_notes: "Full-column probe run.",
    ...extra,
  };
}

async function main() {
  const anon = client();
  const created: string[] = [];

  // 1. anonymous sign-in
  const { data, error } = await anon.auth.signInAnonymously();
  if (error || !data.user) {
    console.error("✗ STEP 1 signInAnonymously failed:", error?.message);
    process.exit(1);
  }
  console.log("✓ STEP 1 anon user", data.user.id, "is_anonymous =", data.user.is_anonymous);
  const anonId = data.user.id;

  // 2a. full-column insert
  const rowA = payload(anonId);
  const insA = await anon.from("lead_intakes").insert(rowA);
  if (insA.error) {
    console.error("✗ STEP 2a insert failed:", insA.error.message, insA.error.details ?? "");
    process.exit(1);
  }
  created.push(rowA.id);
  console.log("✓ STEP 2a full-column insert ok:", rowA.id);

  // 2b. same insert but pre-setting status:'qualified'
  const rowB = payload(anonId, { status: "qualified" });
  const insB = await anon.from("lead_intakes").insert(rowB);
  if (insB.error) {
    console.log(`✓ STEP 2b status:'qualified' insert REJECTED: ${insB.error.message}`);
  } else {
    created.push(rowB.id);
    const check = await anon.from("lead_intakes").select("status").eq("id", rowB.id).maybeSingle();
    console.log(
      `! STEP 2b status:'qualified' insert ACCEPTED — stored status = ${describe(check.data?.status ?? null)}`,
    );
  }

  // 3. anon full read-back
  const back = await anon.from("lead_intakes").select("*").eq("id", rowA.id).maybeSingle();
  if (!back.data) {
    console.error("✗ STEP 3 anon read-back failed:", back.error?.message ?? "no row");
  } else {
    printRow("STEP 3: anon read-back (submitter_sees_own_lead)", back.data);
  }

  // 4. sales_rep read
  const rep = client();
  const repAuth = await rep.auth.signInWithPassword({
    email: process.env["TEST_USER_REP_EMAIL"] ?? "",
    password: process.env["TEST_USER_REP_PASSWORD"] ?? "",
  });
  let repOk = false;
  if (repAuth.error) {
    console.warn("! STEP 4 rep sign-in failed:", repAuth.error.message);
  } else {
    repOk = true;
    const repRead = await rep.from("lead_intakes").select("*").eq("id", rowA.id).maybeSingle();
    if (!repRead.data) {
      console.error("✗ STEP 4 rep read failed:", repRead.error?.message ?? "no row");
    } else {
      printRow("STEP 4: sales_rep read-back", repRead.data);
      const diffs = Object.keys(repRead.data).filter(
        (k) => JSON.stringify(repRead.data![k]) !== JSON.stringify((back.data ?? {})[k]),
      );
      console.log(
        diffs.length === 0
          ? "\n✓ STEP 4 rep values identical to anon values"
          : `\n! STEP 4 differing columns: ${diffs.join(", ")}`,
      );
    }
  }

  // 5. cleanup
  const cleaner = repOk ? rep : anon;
  for (const id of created) {
    const del = await cleaner.from("lead_intakes").delete().eq("id", id);
    console.log(del.error ? `! cleanup ${id}: ${del.error.message}` : `✓ cleaned up ${id}`);
  }
}

void main();
