import { test, expect } from "@playwright/test";

/**
 * Public (anonymous) lead-intake journey.
 *
 * The route is built-but-gated: it is not linked from navigation until the
 * CAPTCHA TODO in src/lib/auth.tsx is resolved, so this test navigates to it
 * directly.
 */
test.describe("public lead intake", () => {
  test("an anonymous visitor can submit a lead and sees a real lead number", async ({ page }) => {
    await page.goto("/get-a-quote");

    await expect(page.getByRole("heading", { name: "Get a quote" })).toBeVisible();
    await expect(page.getByText("Preparing your form…")).toBeHidden({ timeout: 30_000 });

    const stamp = Date.now();
    await page.getByLabel("Organization name").fill(`E2E County ${stamp}`);
    await page.getByLabel("Your name").fill("E2E Visitor");
    await page.getByLabel("Work email").fill(`e2e+${stamp}@example.com`);
    await page.getByLabel("Phone (optional)").fill("555-0100");

    // Step 1 -> 2
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 2 of 6")).toBeVisible();

    // Step 2 -> 3
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 3 of 6")).toBeVisible();

    // Scope: toggle the public portal on and pick a range.
    await page.getByLabel("Public-facing portal needed").click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 4 of 6")).toBeVisible();

    // Compliance chips.
    await page.getByRole("button", { name: "SOC 2" }).click();
    await page.getByRole("button", { name: "HIPAA" }).click();
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 5 of 6")).toBeVisible();

    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByText("Step 6 of 6")).toBeVisible();

    await page.getByLabel(/anything else/i).fill("Submitted by the Playwright e2e suite.");
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
