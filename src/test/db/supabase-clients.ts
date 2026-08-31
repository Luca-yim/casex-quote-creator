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

export type TestRole = "external" | "rep" | "estimator" | "admin";

export interface TestActor {
  role: TestRole;
  userId: string;
  email: string;
  client: SupabaseClient;
}

/**
 * Service-role key for the APP project. Deliberately no fallback to a
 * differently-scoped key: minting against the wrong project yields tokens
 * PostgREST rejects.
 */
export const SERVICE_ROLE_KEY =
  process.env["E2E_SUPABASE_SERVICE_ROLE_KEY"] ??
  process.env["APP_SUPABASE_SERVICE_ROLE_KEY"] ??
  "";

function personaEmail(role: TestRole): string | null {
  return process.env[`TEST_USER_${role.toUpperCase()}_EMAIL`] ?? null;
}

/** Service-role admin client for the app project. */
function adminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anonymous (signed-out) client — used to prove RLS denies public reads. */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Signs in one of the seeded test accounts using the SAME admin-mint
 * mechanism as e2e/scripts/mint-session.ts: an Auth Admin one-time
 * magic-link token redeemed through `verifyOtp`. This never touches the
 * CAPTCHA-gated public sign-in endpoints, so Turnstile stays fully enforced
 * for real users while tests still get real, RLS-scoped sessions.
 *
 * Returns `null` when the service-role key or persona email is missing, so
 * suites skip honestly instead of failing on machines without DB access.
 */
export async function signInAs(role: TestRole): Promise<TestActor | null> {
  const tag = `[signInAs:${role}]`;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn(
      `${tag} skipped — missing ${!SUPABASE_URL ? "VITE_APP_SUPABASE_URL" : "VITE_APP_SUPABASE_PUBLISHABLE_KEY"}`,
    );
    return null;
  }
  const email = personaEmail(role);
  if (!email) {
    console.warn(`${tag} skipped — TEST_USER_${role.toUpperCase()}_EMAIL is not set`);
    return null;
  }
  const admin = adminClient();
  if (!admin) {
    console.warn(`${tag} skipped — E2E_SUPABASE_SERVICE_ROLE_KEY is not set`);
    return null;
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashedToken = data?.properties?.hashed_token;
  if (error || !hashedToken) {
    console.error(
      `${tag} generateLink FAILED for ${email} — ` +
        `status=${(error as { status?: number } | null)?.status ?? "none"} ` +
        `message=${error?.message ?? "no hashed_token returned"}`,
    );
    return null;
  }

  const client = anonClient();
  const { data: verified, error: verifyError } = await client.auth.verifyOtp({
    type: "email",
    token_hash: hashedToken,
  });
  if (verifyError || !verified.session || !verified.user) {
    console.error(
      `${tag} verifyOtp FAILED for ${email} — ` +
        `status=${(verifyError as { status?: number } | null)?.status ?? "none"} ` +
        `message=${verifyError?.message ?? "no session/user returned"}`,
    );
    return null;
  }
  return { role, userId: verified.user.id, email, client };
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
  "DB tests skipped — sessions are minted with the Auth Admin API. Set " +
  "E2E_SUPABASE_SERVICE_ROLE_KEY (app project's service-role key) and " +
  "TEST_USER_*_EMAIL in .env.test.local.";

/**
 * Minimal valid draft payload owned by `userId`.
 *
 * The id is generated client-side: `authenticated` has no SELECT on
 * `public.quotes` (pricing columns may only leave through `quotes_scoped()`),
 * so an insert can never read its own row back with `.select()`.
 */
export function draftPayload(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
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

/** Reads columns of one quote through the role-scoped read function. */
export async function readQuote(
  actor: TestActor,
  quoteId: string,
  columns: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await actor.client
    .rpc("quotes_scoped")
    .select(columns)
    .eq("id", quoteId)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}


/** Deletes quotes created by a suite; ignores rows RLS already blocks. */
export async function cleanupQuotes(actor: TestActor, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await actor.client.from("quotes").delete().in("id", ids);
}

/**
 * Performs a quote state transition the way the app does: through the
 * server-side state machine `transition_quote()`, never a direct UPDATE of
 * `quotes.state`.
 */
export async function transitionQuote(
  actor: TestActor,
  quoteId: string,
  newState: string,
): Promise<{ error: { message: string; code?: string } | null }> {
  const { error } = await actor.client.rpc("transition_quote", {
    p_quote_id: quoteId,
    p_new_state: newState,
  });
  return { error: error ? { message: error.message, code: error.code } : null };
}
