import { expect, test, type Page } from "@playwright/test";
import {
  mockSupabaseAuth,
  realSessionFromEnv,
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
  test.skip(
    !process.env[SESSION_ENV_KEY[persona]],
    `Set ${SESSION_ENV_KEY[persona]} to a real session JSON to run authenticated journeys.`,
  );
}

/** Signs a persona in through the login form, with the auth call mocked. */
export async function signIn(page: Page, persona: Persona): Promise<void> {
  requireRealSession(persona);
  const { email, password } = credentials(persona);
  await mockAuthFor(page, persona);

  await page.goto("/login");
  await waitForLoginHydration(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

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
