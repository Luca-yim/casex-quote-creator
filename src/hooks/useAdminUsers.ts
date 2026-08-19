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

/** Changes a user's role. The database blocks self-escalation. */
export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role } as never)
        .eq("id", userId);
      if (error) throw new Error(describeQuoteWriteError(error));
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

/** Deactivates or reactivates a user by stamping `profiles.deactivated_at`. */
export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, deactivate }: { userId: string; deactivate: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ deactivated_at: deactivate ? new Date().toISOString() : null } as never)
        .eq("id", userId);
      if (error) throw new Error(describeQuoteWriteError(error));
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
