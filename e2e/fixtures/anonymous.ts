import { type Page } from "@playwright/test";
import {
  mockSupabaseAuth,
  realSessionFromEnv,
  requireSessionForAppProject,
  stubTurnstile,
} from "./supabase-auth-mock";

/** Stable synthetic identity for the anonymous lead-intake journey. */
export const ANON_USER = {
  id: process.env["E2E_ANON_USER_ID"] ?? "00000000-0000-4000-8000-0000000000a1",
  email: "",
  role: "anon",
  isAnonymous: true,
};

/**
 * Prepares a page for the public `/get-a-quote` journey:
 * - Turnstile is stubbed client-side (no real challenge in CI).
 * - `supabase.auth.signInAnonymously()` is fulfilled at the network level.
 *
 * Set `E2E_SESSION_ANON` to a real session JSON when the journey must reach
 * the real database (lead insert); otherwise the synthetic token is used and
 * only the client-side flow is exercised.
 */
export async function prepareAnonymousJourney(page: Page): Promise<void> {
  test.skip(
    !process.env["E2E_SESSION_ANON"],
    "Set E2E_SESSION_ANON to a real anonymous session JSON to run the lead insert.",
  );
  await stubTurnstile(page);
  await mockSupabaseAuth(page, {
    user: ANON_USER,
    session: realSessionFromEnv("E2E_SESSION_ANON"),
  });
}
