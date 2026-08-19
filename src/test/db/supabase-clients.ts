import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env.test.local", override: true });

/**
 * The app talks to the external project `lsmrxbpvmvrzpbtjqygh` through the
 * VITE_APP_SUPABASE_* names; the plain VITE_SUPABASE_* names belong to the
 * built-in Lovable Cloud backend, which has none of the quote tables.
 */
export const SUPABASE_URL =
  process.env["VITE_APP_SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
export const SUPABASE_KEY =
  process.env["VITE_APP_SUPABASE_PUBLISHABLE_KEY"] ??
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  "";

export type TestRole = "external" | "rep" | "estimator";

export interface TestActor {
  role: TestRole;
  userId: string;
  email: string;
  client: SupabaseClient;
}

function credentials(role: TestRole): { email: string; password: string } | null {
  const key = role.toUpperCase();
  const email = process.env[`TEST_USER_${key}_EMAIL`];
  const password = process.env[`TEST_USER_${key}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

/** Anonymous (signed-out) client — used to prove RLS denies public reads. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Signs in one of the seeded test accounts. Returns `null` when credentials
 * are missing or rejected so suites can skip instead of failing the build on
 * machines without database access.
 */
export async function signInAs(role: TestRole): Promise<TestActor | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const creds = credentials(role);
  if (!creds) return null;

  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword(creds);
  if (error || !data.user) return null;
  return { role, userId: data.user.id, email: creds.email, client };
}

export interface TestActors {
  external: TestActor | null;
  rep: TestActor | null;
  estimator: TestActor | null;
}

/** Signs in all three personas in parallel. */
export async function signInAllActors(): Promise<TestActors> {
  const [external, rep, estimator] = await Promise.all([
    signInAs("external"),
    signInAs("rep"),
    signInAs("estimator"),
  ]);
  return { external, rep, estimator };
}

/** True when every persona authenticated; suites skip otherwise. */
export function actorsReady(actors: TestActors): boolean {
  return !!(actors.external && actors.rep && actors.estimator);
}

export const SKIP_REASON =
  "DB tests skipped — set TEST_USER_*_EMAIL / _PASSWORD in .env.test.local " +
  "with real accounts (see `npm run test:db:setup`).";

/** Minimal valid draft payload owned by `userId`. */
export function draftPayload(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    name: `DB test quote ${Date.now()}`,
    requested_by: userId,
    owner_id: userId,
    state: "draft",
    tier: "ballpark",
    margin_percent: 20,
    contract_years: 3,
    ...overrides,
  };
}

/** Deletes quotes created by a suite; ignores rows RLS already blocks. */
export async function cleanupQuotes(actor: TestActor, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await actor.client.from("quotes").delete().in("id", ids);
}
