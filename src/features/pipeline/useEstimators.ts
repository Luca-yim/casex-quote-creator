import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface EstimatorOption {
  id: string;
  name: string;
}

/** Loads estimator/admin profiles for the "Approved by" filter. */
export function useEstimators(enabled = true) {
  return useQuery({
    queryKey: ["estimator-options"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<EstimatorOption[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .in("role", ["estimator", "admin"]);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<Record<string, string | null>>)
        .map((row) => ({
          id: String(row["id"]),
          name: row["full_name"] || row["email"] || "Unnamed estimator",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}
