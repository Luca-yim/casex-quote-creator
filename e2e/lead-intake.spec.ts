import { test, expect } from "@playwright/test";
import { prepareAnonymousJourney } from "./fixtures/anonymous";

/**
 * Public (anonymous) lead-intake journey.
 *
 * The route is public and linked from the landing page. Anonymous sign-in is
 * gated by Cloudflare Turnstile. In CI the widget script is stubbed and the
 * Supabase auth endpoint is mocked at the network level (see
 * fixtures/anonymous.ts) — the real CAPTCHA is never solved or bypassed
 * server-side.
 */
test.describe("public lead intake", () => {
  test("an anonymous visitor can submit a lead and sees a real lead number", async ({ page }) => {
    await prepareAnonymousJourney(page);
    await page.goto("/get-a-quote");

    await expect(page.getByRole("heading", { name: "Get a quote" })).toBeVisible();
    // The gate screen replaces the form entirely until the anonymous session
    // is ready; the stubbed widget resolves immediately.
    await expect(page.getByText("Step 1 of 6")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Preparing your form…")).toHaveCount(0);
    await expect(page.getByTestId("turnstile-widget")).toHaveCount(0);

    const stamp = Date.now();

    // Step 1 (vertical & solution) -> 2
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 2 of 6")).toBeVisible();

    // Step 2 (scope): toggle the public portal on.
    await page.getByLabel("Public-facing portal needed").click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 3 of 6")).toBeVisible();

    // Step 3 (compliance chips).
    await page.getByRole("button", { name: "SOC 2" }).click();
    await page.getByRole("button", { name: "HIPAA" }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 4 of 6")).toBeVisible();

    // Step 4 (integrations) -> 5
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 5 of 6")).toBeVisible();

    // Step 5 (notes) -> 6
    await page.getByLabel(/anything else/i).fill("Submitted by the Playwright e2e suite.");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 6 of 6")).toBeVisible();

    // Step 6: contact & organization.
    await page.getByLabel("Organization name").fill(`E2E County ${stamp}`);
    await page.getByLabel("Your name").fill("E2E Visitor");
    await page.getByLabel("Work email").fill(`e2e+${stamp}@example.com`);
    await page.getByLabel("Phone (optional)").fill("555-0100");

    const submit = page.getByRole("button", { name: /submit request/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByRole("heading", { name: /we've got your request/i })).toBeVisible({
      timeout: 30_000,
    });

    const leadNumber = page.getByTestId("lead-number");
    await expect(leadNumber).toBeVisible();
    await expect(leadNumber).not.toBeEmpty();

    // No pricing may ever appear on the public path.
    await expect(page.getByText(/\$\s?\d/)).toHaveCount(0);
  });
});
