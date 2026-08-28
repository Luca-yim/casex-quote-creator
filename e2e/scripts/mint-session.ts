/**
 * Mints real Supabase sessions for the seeded E2E personas.
 *
 * Runs SERVER-SIDE ONLY with the service-role key (same constraint as
 * src/integrations/supabase/client.server.ts). It never touches the
 * CAPTCHA-gated public endpoints: it asks the Auth Admin API for a one-time
 * magic-link token and exchanges it through `verifyOtp`, which is not a
 * public sign-in endpoint. The server-side CAPTCHA requirement on
 * signInWithPassword/signInAnonymously stays fully intact.
 *
 * Usage:
 *   npx tsx e2e/scripts/mint-session.ts            # prints shell exports
 *   npx tsx e2e/scripts/mint-session.ts --github   # writes to $GITHUB_ENV
 *
 * Output: E2E_SESSION_REP / _EXTERNAL / _ESTIMATOR / _ANON (session JSON).
 * These are job-scoped secrets — never commit them.
 */
import { createClient, type Session } from "@supabase/supabase-js";
import { appendFileSync } from "node:fs";

type PersonaKey = "REP" | "EXTERNAL" | "ESTIMATOR" | "ANON";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const PUBLISHABLE_KEY = requireEnv("SUPABASE_PUBLISHABLE_KEY");

/** Email addresses of the seeded personas. */
const PERSONA_EMAIL: Record<PersonaKey, string> = {
  REP: process.env["TEST_USER_REP_EMAIL"] ?? "rep@test.local",
  EXTERNAL: process.env["TEST_USER_EXTERNAL_EMAIL"] ?? "external@test.local",
  ESTIMATOR: process.env["TEST_USER_ESTIMATOR_EMAIL"] ?? "estimator@test.local",
  // The public lead-intake journey runs as a real anonymous auth user.
  ANON: process.env["TEST_USER_ANON_EMAIL"] ?? "",
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. This script is server-side only.`);
  return value;
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A fresh public client with no stored session, used only to redeem tokens. */
function publicClient() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Exchanges an admin-issued magic-link token for a real session. */
async function mintForEmail(email: string): Promise<Session> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink(${email}): ${error.message}`);

  const hashedToken = data.properties?.hashed_token;
  if (!hashedToken) throw new Error(`generateLink(${email}) returned no hashed_token`);

  const { data: verified, error: verifyError } = await publicClient().auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });
  if (verifyError || !verified.session) {
    throw new Error(`verifyOtp(${email}): ${verifyError?.message ?? "no session"}`);
  }
  return verified.session;
}

/**
 * The anonymous persona: a disposable auth user created through the Admin API.
 * `signInAnonymously()` is CAPTCHA-gated for public callers and stays that way.
 */
async function mintAnonymous(): Promise<Session> {
  const email = PERSONA_EMAIL.ANON || `e2e-anon+${Date.now()}@test.local`;
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { e2e_anonymous_persona: true },
  });
  // A pre-existing user is fine; anything else is fatal.
  if (error && !/already/i.test(error.message)) {
    throw new Error(`createUser(${email}): ${error.message}`);
  }
  return mintForEmail(email);
}

async function main(): Promise<void> {
  const toGithubEnv = process.argv.includes("--github");
  const results: Array<[string, string]> = [];

  for (const key of ["REP", "EXTERNAL", "ESTIMATOR"] as const) {
    const session = await mintForEmail(PERSONA_EMAIL[key]);
    results.push([`E2E_SESSION_${key}`, JSON.stringify(session)]);
    console.error(`minted E2E_SESSION_${key} for ${PERSONA_EMAIL[key]} (user ${session.user.id})`);
  }

  const anon = await mintAnonymous();
  results.push(["E2E_SESSION_ANON", JSON.stringify(anon)]);
  console.error(`minted E2E_SESSION_ANON (user ${anon.user.id})`);

  if (toGithubEnv) {
    const file = requireEnv("GITHUB_ENV");
    for (const [name, value] of results) {
      // Mask before exporting so the token never appears in the job log.
      console.log(`::add-mask::${value}`);
      appendFileSync(file, `${name}<<__E2E_EOF__\n${value}\n__E2E_EOF__\n`);
    }
    console.error(`wrote ${results.length} sessions to $GITHUB_ENV`);
    return;
  }

  for (const [name, value] of results) {
    console.log(`export ${name}=${JSON.stringify(value)}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
