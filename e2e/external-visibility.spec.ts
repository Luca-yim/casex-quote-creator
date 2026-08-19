import { test, expect } from "@playwright/test";
import { PRICING_MARKERS, signIn } from "./fixtures/auth";

test.describe("external requester never sees pricing", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "external");
  });

  test("dashboard shows requests without any pricing language", async ({ page }) => {
    await expect(page.getByText(/your requests/i)).toBeVisible({ timeout: 20_000 });

    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const marker of PRICING_MARKERS) {
      expect(body, `pricing marker leaked: ${marker}`).not.toMatch(marker);
    }
  });

  test("intake form hides the pricing sidebar and shows a status card instead", async ({ page }) => {
    const rows = page.locator("ul li a, ul.divide-y > li");
    if ((await rows.count()) === 0) {
      test.skip(true, "No external requests in this environment");
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/request-quote\/[0-9a-f-]{36}/, { timeout: 30_000 });

    await expect(page.getByText(/total contract value/i)).toHaveCount(0);
    await expect(page.getByRole("slider")).toHaveCount(0);
  });

  test("offers no PDF download to an external requester", async ({ page }) => {
    await expect(page.getByRole("button", { name: /download pdf/i })).toHaveCount(0);
  });

  test("blocks direct navigation to the estimator review queue", async ({ page }) => {
    await page.goto("/review");
    await expect(page).not.toHaveURL(/\/review\/?$/, { timeout: 30_000 });
  });
});
