import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env.test.local", override: true });

const isCI = !!process.env["CI"];

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Some sandboxes ship only the full Chrome build; point at it when provided.
        launchOptions: process.env["E2E_CHROME_PATH"]
          ? { executablePath: process.env["E2E_CHROME_PATH"], args: ["--no-sandbox"] }
          : {},
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    env: {
      // Real (public) site key. CI never solves it: Playwright stubs the
      // Turnstile script and mocks the Supabase auth endpoints in-browser.
      VITE_APP_TURNSTILE_SITE_KEY:
        process.env["VITE_APP_TURNSTILE_SITE_KEY"] ?? "0x4AAAAAAEfi_SCZy4f9X76o",
    },
    url: process.env["E2E_BASE_URL"] ?? "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
