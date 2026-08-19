import { expect, type Page } from "@playwright/test";

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

/** Reads the credentials for a persona from the test environment. */
export function credentials(persona: Persona): { email: string; password: string } {
  const keys = ENV_KEYS[persona];
  const email = process.env[keys.email];
  const password = process.env[keys.password];

  if (!email || !password) {
    throw new Error(
      `Missing ${keys.email}/${keys.password}. Set them in .env.test.local.`,
    );
  }

  return { email, password };
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

/** Signs a persona in through the real login form and waits for their home route. */
export async function signIn(page: Page, persona: Persona): Promise<void> {
  const { email, password } = credentials(persona);

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
