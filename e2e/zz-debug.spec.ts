import { test, expect } from "@playwright/test";
import { credentials, mockAuthFor, waitForLoginHydration } from "./fixtures/auth";

test("debug rep sign in", async ({ page }) => {
  page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 300)));
  page.on("response", (r) => { if (!r.ok()) console.log("HTTP", r.status(), r.url().slice(0, 160)); });
  const { email, password } = credentials("rep");
  await mockAuthFor(page, "rep");
  await page.goto("/login");
  await waitForLoginHydration(page);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForTimeout(8000);
  console.log("URL", page.url());
  console.log((await page.locator("body").innerText()).slice(0, 600));
});
