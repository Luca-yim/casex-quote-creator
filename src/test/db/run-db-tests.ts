/**
 * Entry point for `npm run test:db`.
 *
 * Confirms credentials are present, then hands off to Vitest with the
 * node-environment DB config. Exits 0 with a notice when personas are not
 * configured so CI without backend access is not blocked.
 */
import { spawnSync } from "node:child_process";
import { signInAllActors, actorsReady, SKIP_REASON } from "./supabase-clients";

async function main(): Promise<void> {
  const actors = await signInAllActors();
  if (!actorsReady(actors)) {
    console.warn(SKIP_REASON);
    process.exit(0);
  }

  const result = spawnSync(
    "npx",
    ["vitest", "run", "--config", "vitest.db.config.ts"],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  process.exit(result.status ?? 1);
}

void main();
