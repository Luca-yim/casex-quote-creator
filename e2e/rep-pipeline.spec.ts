import { test, expect } from "@playwright/test";
import { signIn } from "./fixtures/auth";

test.describe("sales rep pipeline", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "rep");
  });

  test("shows every pipeline tab with a count badge", async ({ page }) => {
    for (const label of ["Drafts", "Under Review", "Approved", "Sent", "Closed"]) {
      await expect(page.getByRole("tab", { name: new RegExp(label, "i") })).toBeVisible({
        timeout: 20_000,
      });
    }
    await expect(page.getByText(/Pricing stays hidden until an estimator approves/i)).toBeVisible();
  });

  test("creates a draft from the New quote button and opens the intake form", async ({ page }) => {
    await page.getByRole("link", { name: /new quote/i }).click();

    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}/, { timeout: 45_000 });
    await expect(page.getByText(/pipeline status/i)).toBeVisible({ timeout: 30_000 });
  });

  test("lets a rep edit a draft and shows the readiness progress", async ({ page }) => {
    await page.getByRole("link", { name: /new quote/i }).click();
    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}/, { timeout: 45_000 });

    const customer = page.getByLabel(/customer organization/i).first();
    await customer.fill("Playwright County Services");
    await expect(customer).toHaveValue("Playwright County Services");

    await expect(page.getByText(/\d+\s*\/\s*8/)).toBeVisible({ timeout: 20_000 });
  });

  test("opens a quote row in read-only detail when it is past draft", async ({ page }) => {
    await page.getByRole("tab", { name: /under review/i }).click();
    const rows = page.locator("ul.divide-y > li");

    if ((await rows.count()) === 0) {
      test.skip(true, "No quotes under review in this environment");
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /submit for review/i })).toHaveCount(0);
  });
});
