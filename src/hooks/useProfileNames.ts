import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Bulk-resolves user uuids to display names for `user`-type table columns.
 *
 * One query per set of ids — never a lookup per cell.
 */
export function useProfileNames(ids: Array<string | null | undefined>) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[])).sort();

  return useQuery({
    queryKey: ["profile-names", unique.join(",")],
    enabled: unique.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", unique);
      if (error) throw new Error(error.message);

      const map: Record<string, string> = {};
      for (const row of (data ?? []) as Array<Record<string, string | null>>) {
        const id = String(row["id"]);
        map[id] = row["full_name"] || row["email"] || "Unknown user";
      }
      return map;
    },
  });
}
