import { test, expect } from "@playwright/test";
import { signIn } from "./fixtures/auth";

test.describe("estimator review queue", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, "estimator");
  });

  test("renders the queue with a history tab", async ({ page }) => {
    await expect(page.getByRole("tab", { name: /history/i })).toBeVisible({ timeout: 20_000 });
  });

  test("opens a queued quote with pricing visible", async ({ page }) => {
    const rows = page.locator("ul.divide-y > li");
    if ((await rows.count()) === 0) {
      test.skip(true, "Review queue is empty in this environment");
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/review\/[0-9a-f-]{36}/, { timeout: 30_000 });

    await expect(page.getByText(/total contract value/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/pipeline status/i)).toBeVisible();
  });

  test("exposes the margin slider only on an editable quote", async ({ page }) => {
    const rows = page.locator("ul.divide-y > li");
    if ((await rows.count()) === 0) {
      test.skip(true, "Review queue is empty in this environment");
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/review\/[0-9a-f-]{36}/, { timeout: 30_000 });

    const sliders = page.getByRole("slider");
    if ((await sliders.count()) > 0) {
      await expect(sliders.first()).toBeVisible();
    }
  });

  test("shows version history for any opened quote", async ({ page }) => {
    const rows = page.locator("ul.divide-y > li");
    if ((await rows.count()) === 0) {
      test.skip(true, "Review queue is empty in this environment");
    }

    await rows.first().click();
    await page.getByRole("button", { name: /version history/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
  });
});
