import { test, expect } from "@playwright/test";
import {
  credentials,
  HOME_ROUTE,
  mockAuthFor,
  signIn,
  waitForLoginHydration,
  type Persona,
} from "./fixtures/auth";

test.describe("authentication and role routing", () => {
  test("redirects an anonymous visitor from a protected route to /login", async ({ page }) => {
    await page.goto("/quotes");
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  });

  test("rejects invalid credentials without navigating away", async ({ page }) => {
    await mockAuthFor(page, "rep");
    await page.goto("/login");
    await waitForLoginHydration(page);
    await page.getByLabel("Work email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByText(/invalid login credentials/i)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("validates the email field before hitting the network", async ({ page }) => {
    await page.goto("/login");
    await waitForLoginHydration(page);
    await page.getByLabel("Work email").fill("not-an-email");
    await page.getByLabel("Password").fill("secret123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByText("Enter a valid email")).toBeVisible();
  });

  for (const persona of ["external", "rep", "estimator"] as Persona[]) {
    test(`signs in a ${persona} and lands on their home route`, async ({ page }) => {
      await signIn(page, persona);
      await expect(page).toHaveURL(HOME_ROUTE[persona]);
    });
  }

  test("keeps a signed-in rep out of the estimator review queue", async ({ page }) => {
    await signIn(page, "rep");
    await page.goto("/review");
    await expect(page).not.toHaveURL(/\/review\/?$/, { timeout: 30_000 });
  });

  test("keeps an external requester out of the rep pipeline", async ({ page }) => {
    await signIn(page, "external");
    await page.goto("/quotes");
    await expect(page).not.toHaveURL(/\/quotes\/?$/, { timeout: 30_000 });
  });

  test("exposes the persona emails only to the signed-in user", async ({ page }) => {
    const { email } = credentials("rep");
    await signIn(page, "rep");
    await expect(page.locator("body")).toContainText(email.split("@")[0]!, {
      ignoreCase: true,
      timeout: 20_000,
    });
  });
});
