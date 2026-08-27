import { beforeAll, describe, expect, it } from "vitest";
import { signInAs, SKIP_REASON, type TestActor } from "./supabase-clients";

let rep: TestActor | null = null;

beforeAll(async () => {
  rep = await signInAs("rep");
  if (!rep) console.warn(SKIP_REASON);
});

describe.runIf(process.env["VITEST_DB"] !== "0")("privilege escalation", () => {
  it("blocks a sales rep from promoting themselves to admin", async () => {
    if (!rep) return;

    const { data, error } = await rep.client
      .from("profiles")
      .update({ role: "admin" } as never)
      .eq("id", rep.userId)
      .select("id, role");

    // Either the trigger/RLS rejects it outright, or the policy filters the
    // row so nothing is updated. Silently succeeding is a security failure.
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    const { data: after } = await rep.client
      .from("profiles")
      .select("role")
      .eq("id", rep.userId)
      .maybeSingle();
    expect((after as { role?: string } | null)?.role).not.toBe("admin");
  });

  it("blocks a sales rep from calling the admin role RPC", async () => {
    if (!rep) return;

    const { error } = await (rep.client.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>)("admin_update_user_role", {
      target_user_id: rep.userId,
      new_role: "admin",
      reason: "authz test",
    });
    expect(error).not.toBeNull();

    const { data: after } = await rep.client
      .from("profiles")
      .select("role")
      .eq("id", rep.userId)
      .maybeSingle();
    expect((after as { role?: string } | null)?.role).not.toBe("admin");
  });
});
