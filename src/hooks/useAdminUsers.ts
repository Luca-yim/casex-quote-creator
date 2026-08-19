import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { describeQuoteWriteError } from "@/lib/supabase-errors";
import type { AppRole } from "@/lib/auth-types";

export interface AdminUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  createdAt: string | null;
  deactivatedAt: string | null;
}

const ROLES: AppRole[] = ["admin", "estimator", "sales_rep", "external"];

export const adminUsersKey = ["admin", "users"] as const;

type Row = Record<string, unknown>;

function toUser(row: Row): AdminUser {
  const role = String(row["role"] ?? "external") as AppRole;
  return {
    id: String(row["id"]),
    email: (row["email"] as string | null) ?? null,
    fullName: (row["full_name"] as string | null) ?? null,
    role: ROLES.includes(role) ? role : "external",
    createdAt: (row["created_at"] as string | null) ?? null,
    deactivatedAt: (row["deactivated_at"] as string | null) ?? null,
  };
}

/** All profiles, newest first. Admin-only in practice (RLS gates the read). */
export function useAdminUsers() {
  return useQuery({
    queryKey: adminUsersKey,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<AdminUser[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(describeQuoteWriteError(error));
      return ((data ?? []) as Row[]).map(toUser);
    },
  });
}

/**
 * Changes a user's role through the `admin_update_user_role` RPC.
 *
 * A direct PATCH on `profiles` cannot work: RLS limits UPDATE to the row
 * owner, so an admin editing someone else's row matches zero rows and
 * PostgREST still answers 204. The SECURITY DEFINER function is the only
 * supported path and it also writes the admin audit log.
 */
export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      role,
      reason,
    }: {
      userId: string;
      role: AppRole;
      reason?: string | null;
    }) => {
      const { error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>)("admin_update_user_role", {
        target_user_id: userId,
        new_role: role,
        reason: reason || null,
      });
      if (error) throw new Error(error.message);
      return { userId, role };
    },
    onSuccess: ({ role }) => {
      toast.success(`Role updated to ${role.replace("_", " ")}`);
      void qc.invalidateQueries({ queryKey: adminUsersKey });
      void qc.invalidateQueries({ queryKey: ["sales-reps"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Deactivates or reactivates a user. Prefers the `admin_toggle_user_active`
 * RPC; falls back to a direct update (and verifies a row actually changed)
 * when that function is not deployed.
 */
export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, deactivate }: { userId: string; deactivate: boolean }) => {
      const rpc = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string; code?: string } | null }>;
      const { error: rpcError } = await rpc("admin_toggle_user_active", {
        target_user_id: userId,
        deactivate,
      });
      if (!rpcError) return { deactivate };
      // PGRST202 = function does not exist in the schema cache.
      if (rpcError.code && rpcError.code !== "PGRST202") {
        throw new Error(rpcError.message);
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({ deactivated_at: deactivate ? new Date().toISOString() : null } as never)
        .eq("id", userId)
        .select("id");
      if (error) throw new Error(describeQuoteWriteError(error));
      if (!data || data.length === 0) {
        throw new Error(
          "No profile was updated — your admin permissions did not allow this change.",
        );
      }
      return { deactivate };
    },
    onSuccess: ({ deactivate }) => {
      toast.success(deactivate ? "User deactivated" : "User reactivated");
      void qc.invalidateQueries({ queryKey: adminUsersKey });
      void qc.invalidateQueries({ queryKey: ["sales-reps"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

