import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/auth-types";

export interface OwnerOption {
  id: string;
  name: string;
  role: AppRole;
}

const ROLE_LABELS: Record<string, string> = {
  sales_rep: "Sales rep",
  estimator: "Estimator",
  admin: "Admin",
};

/** Human label for an owner option, e.g. "Sarah Lee · Sales rep". */
export function ownerOptionLabel(option: OwnerOption): string {
  return `${option.name} · ${ROLE_LABELS[option.role] ?? option.role}`;
}

/**
 * Internal users who can own a quote during rework: sales reps, estimators
 * and admins. External requesters are deliberately excluded — quotes are
 * never returned to them.
 */
export function useAssignableOwners(enabled = true) {
  return useQuery({
    queryKey: ["assignable-owners"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<OwnerOption[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .in("role", ["sales_rep", "estimator", "admin"]);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<Record<string, string | null>>)
        .map((row) => ({
          id: String(row["id"]),
          name: row["full_name"] || row["email"] || "Unnamed user",
          role: (row["role"] as AppRole) ?? "sales_rep",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}
