import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface SalesRepOption {
  id: string;
  name: string;
}

/** Loads all sales-rep profiles, alphabetically, for assignment dropdowns. */
export function useSalesReps(enabled = true) {
  return useQuery({
    queryKey: ["sales-reps"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SalesRepOption[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .eq("role", "sales_rep");
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<Record<string, string | null>>)
        .map((row) => ({
          id: String(row["id"]),
          name: row["full_name"] || row["email"] || "Unnamed rep",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}
