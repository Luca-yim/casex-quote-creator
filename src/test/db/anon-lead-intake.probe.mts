/**
 * Throwaway probe: can an anonymous (signInAnonymously) visitor create and
 * read back a `lead_intakes` row, and can a seeded sales_rep read it too?
 *
 * Run with: bun src/test/db/anon-lead-intake.probe.mts
 * Delete once the anonymous lead-intake path is settled.
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

async function main() {
  const anon = client();

  // 1-3. anonymous sign-in
  const { data, error } = await anon.auth.signInAnonymously();
  if (error || !data.user) {
    console.error("✗ signInAnonymously failed:", error?.message);
    process.exit(1);
  }
  console.log("✓ anon user", data.user.id, "is_anonymous =", data.user.is_anonymous);

  // 4. insert
  const id = crypto.randomUUID();
  const row = {
    id,
    submitted_by_anon_id: data.user.id,
    company_name: "Probe Co",
    contact_name: "Probe Contact",
    contact_email: `probe+${Date.now()}@example.com`,
  };
  const ins = await anon.from("lead_intakes").insert(row);
  console.log(ins.error ? `✗ insert: ${ins.error.message}` : "✓ insert ok");
  if (ins.error) process.exit(1);

  // 5. read back as the same anon client
  const back = await anon.from("lead_intakes").select("id").eq("id", id).maybeSingle();
  console.log(back.data ? "✓ anon read-back ok" : `✗ anon read-back: ${back.error?.message ?? "no row"}`);

  // 6. seeded sales_rep read
  const rep = client();
  const repAuth = await rep.auth.signInWithPassword({
    email: process.env["TEST_USER_REP_EMAIL"] ?? "",
    password: process.env["TEST_USER_REP_PASSWORD"] ?? "",
  });
  if (repAuth.error) {
    console.warn("! rep sign-in failed:", repAuth.error.message);
  } else {
    const repRead = await rep.from("lead_intakes").select("id").eq("id", id).maybeSingle();
    console.log(repRead.data ? "✓ rep read ok" : `✗ rep read: ${repRead.error?.message ?? "no row"}`);
  }

  // 7. cleanup
  const del = await (repAuth.error ? anon : rep).from("lead_intakes").delete().eq("id", id);
  console.log(del.error ? `! cleanup: ${del.error.message}` : "✓ cleaned up");
}

void main();
