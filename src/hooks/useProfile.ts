import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AppRole, Profile } from "@/lib/auth-types";

export const profileQueryKey = (userId: string | undefined) => ["profile", userId] as const;

const ROLES: AppRole[] = ["admin", "estimator", "sales_rep", "external"];

/**
 * Loads the signed-in user's profile row.
 *
 * A missing profile row is NOT an error here — it resolves to `null` so the
 * caller (AuthGate) can decide how to treat it. While no user id is known the
 * query stays disabled and the hook reports `isLoading: true`.
 */
export function useProfile(userId: string | undefined) {
  const query = useQuery({
    queryKey: profileQueryKey(userId),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as Profile;
      return {
        ...row,
        role: row.role && ROLES.includes(row.role) ? row.role : "external",
      };
    },
  });

  return {
    profile: query.data ?? null,
    isLoading: userId ? query.isPending : false,
    isError: query.isError,
    error: query.error as Error | null,
  };
}
