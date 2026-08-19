/**
 * Verifies that the three DB-test personas exist and can sign in.
 *
 * Accounts are NOT created here: the service role key is not available to the
 * app, so users must be created once through the app's signup flow (or the
 * backend user management screen) and their role set on `profiles.role`.
 *
 * Run with: npm run test:db:setup
 */
import { signInAs, SUPABASE_URL, type TestRole } from "./supabase-clients";

const ROLES: Array<{ role: TestRole; expectedProfileRole: string }> = [
  { role: "external", expectedProfileRole: "external" },
  { role: "rep", expectedProfileRole: "sales_rep" },
  { role: "estimator", expectedProfileRole: "estimator" },
];

async function main(): Promise<void> {
  if (!SUPABASE_URL) {
    console.error("Missing VITE_SUPABASE_URL — check .env.test");
    process.exit(1);
  }

  let ok = true;
  for (const { role, expectedProfileRole } of ROLES) {
    const actor = await signInAs(role);
    if (!actor) {
      ok = false;
      console.error(
        `✗ ${role}: cannot sign in. Create the account in the app, then set ` +
          `TEST_USER_${role.toUpperCase()}_EMAIL / _PASSWORD in .env.test.local`,
      );
      continue;
    }

    const { data, error } = await actor.client
      .from("profiles")
      .select("role")
      .eq("id", actor.userId)
      .maybeSingle();

    if (error || !data) {
      ok = false;
      console.error(`✗ ${role}: signed in but no profile row (${error?.message ?? "missing"})`);
      continue;
    }
    if (data.role !== expectedProfileRole) {
      ok = false;
      console.error(
        `✗ ${role}: profile role is "${data.role}", expected "${expectedProfileRole}". ` +
          `Update the row in the backend before running DB tests.`,
      );
      continue;
    }
    console.log(`✓ ${role}: ${actor.email} (${actor.userId})`);
  }

  if (!ok) {
    console.error("\nOne or more personas are not ready. DB tests will skip.");
    process.exit(1);
  }
  console.log("\nAll personas ready — run `npm run test:db`.");
}

void main();
