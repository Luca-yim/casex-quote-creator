import { expect, type Page } from "@playwright/test";
import {
  logNetwork,
  logSessionEnv,
  mockSupabaseAuth,
  realSessionFromEnv,
  requireSessionForAppProject,
  stubTurnstile,
} from "./supabase-auth-mock";

export type Persona = "external" | "rep" | "estimator";

const ENV_KEYS: Record<Persona, { email: string; password: string }> = {
  external: {
    email: "TEST_USER_EXTERNAL_EMAIL",
    password: "TEST_USER_EXTERNAL_PASSWORD",
  },
  rep: { email: "TEST_USER_REP_EMAIL", password: "TEST_USER_REP_PASSWORD" },
  estimator: {
    email: "TEST_USER_ESTIMATOR_EMAIL",
    password: "TEST_USER_ESTIMATOR_PASSWORD",
  },
};

/** Home route each persona should land on after sign-in. */
export const HOME_ROUTE: Record<Persona, RegExp> = {
  external: /\/request-quote(\/|$)/,
  rep: /\/quotes\/?$/,
  estimator: /\/review\/?$/,
};

const FALLBACK_CREDENTIALS: Record<Persona, { email: string; password: string }> = {
  external: { email: "external@test.local", password: "e2e-mocked-password" },
  rep: { email: "rep@test.local", password: "e2e-mocked-password" },
  estimator: { email: "estimator@test.local", password: "e2e-mocked-password" },
};

/** Stable synthetic user ids used by the mocked sessions. */
const PERSONA_USER_ID: Record<Persona, string> = {
  external: "00000000-0000-4000-8000-0000000000e1",
  rep: "00000000-0000-4000-8000-0000000000b1",
  estimator: "00000000-0000-4000-8000-0000000000c1",
};

const SESSION_ENV_KEY: Record<Persona, string> = {
  external: "E2E_SESSION_EXTERNAL",
  rep: "E2E_SESSION_REP",
  estimator: "E2E_SESSION_ESTIMATOR",
};

/**
 * Credentials for a persona. Real values may come from `.env.test.local`;
 * otherwise deterministic placeholders are used, which is fine because the
 * auth endpoint is mocked at the network level in CI.
 */
export function credentials(persona: Persona): { email: string; password: string } {
  const keys = ENV_KEYS[persona];
  return {
    email: process.env[keys.email] ?? FALLBACK_CREDENTIALS[persona].email,
    password: process.env[keys.password] ?? FALLBACK_CREDENTIALS[persona].password,
  };
}

/**
 * Installs the network-level auth mock for a persona. No CAPTCHA token and no
 * credentials ever reach the real backend; the server-side CAPTCHA check is
 * untouched.
 */
export async function mockAuthFor(page: Page, persona: Persona): Promise<void> {
  const creds = credentials(persona);
  await stubTurnstile(page);
  await mockSupabaseAuth(page, {
    user: { id: PERSONA_USER_ID[persona], email: creds.email, role: persona },
    session: realSessionFromEnv(SESSION_ENV_KEY[persona]),
    accept: creds,
  });
}

/**
 * Waits until React has hydrated the login form. Submitting before hydration
 * performs a native GET and leaks the credentials into the URL.
 */
export async function waitForLoginHydration(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  // The client router swaps in the interactive tree; give it a beat to attach handlers.
  await page.waitForTimeout(500);
}

/**
 * Skips the current test unless a real session was supplied for the persona.
 *
 * The mocked session is enough to exercise the login form itself, but any
 * assertion past the guard needs a token the real backend accepts (role lookup,
 * quote reads). Production and test share one backend and the CAPTCHA check is
 * never short-circuited server-side, so CI cannot mint one itself.
 */
export function requireRealSession(persona: Persona): void {
  requireSessionForAppProject(SESSION_ENV_KEY[persona]);
}

/** Diagnostic switch: `E2E_DEBUG_AUTH=1` turns on the real-session tracing. */
const DEBUG_AUTH = process.env["E2E_DEBUG_AUTH"] === "1";

/** Polls client-side state so a stuck sign-in is visible, not just a timeout. */
async function traceClientState(page: Page, persona: Persona, seconds = 20): Promise<void> {
  for (let t = 0; t <= seconds; t += 5) {
    const snapshot = await page
      .evaluate(() => {
        const authKeys = Object.keys(window.localStorage).filter((k) => /auth-token/.test(k));
        const stored = authKeys[0] ? window.localStorage.getItem(authKeys[0]) : null;
        let userId: string | null = null;
        try {
          userId = stored ? (JSON.parse(stored).user?.id ?? null) : null;
        } catch {
          userId = "(unparseable)";
        }
        const body = document.body?.innerText?.replace(/\s+/g, " ").slice(0, 160) ?? "";
        return { href: location.href, authKeys, userId, body };
      })
      .catch((e: unknown) => ({ error: String(e) }));
    console.log(`[state ${persona} t+${t}s] ${JSON.stringify(snapshot)}`);
    if (t < seconds) await page.waitForTimeout(5_000);
  }
}

/** Signs a persona in through the login form, with the auth call mocked. */
export async function signIn(page: Page, persona: Persona): Promise<void> {
  if (DEBUG_AUTH) logSessionEnv(SESSION_ENV_KEY[persona]);
  requireRealSession(persona);
  const { email, password } = credentials(persona);
  if (DEBUG_AUTH) {
    logNetwork(page, persona);
    console.log(`[signin ${persona}] credentials email=${email} passwordLength=${password.length}`);
    console.log(
      `[signin ${persona}] session source=${realSessionFromEnv(SESSION_ENV_KEY[persona]) ? "REAL env session" : "SYNTHETIC fallback"}`,
    );
  }
  await mockAuthFor(page, persona);

  await page.goto("/login");
  await waitForLoginHydration(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (DEBUG_AUTH) console.log(`[signin ${persona}] clicked Sign in at ${new Date().toISOString()}`);

  if (DEBUG_AUTH) {
    await traceClientState(page, persona);
  }

  await expect(page).toHaveURL(HOME_ROUTE[persona], { timeout: 45_000 });
}

/** Text fragments that must never be visible to an external requester. */
export const PRICING_MARKERS = [
  /total contract value/i,
  /margin/i,
  /list price/i,
  /discount/i,
  /\$\s?\d/,
];
