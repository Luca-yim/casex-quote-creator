import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/auth-types";

export type ProfileSummary = { name: string; role: AppRole | null };

/**
 * Bulk-resolves user uuids to display name + role.
 *
 * One query per set of ids — never a lookup per cell.
 */
export function useProfileDirectory(ids: Array<string | null | undefined>) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[])).sort();

  return useQuery({
    queryKey: ["profile-directory", unique.join(",")],
    enabled: unique.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, ProfileSummary>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", unique);
      if (error) throw new Error(error.message);

      const map: Record<string, ProfileSummary> = {};
      for (const row of (data ?? []) as Array<Record<string, string | null>>) {
        const id = String(row["id"]);
        map[id] = {
          name: row["full_name"] || row["email"] || "Unknown user",
          role: (row["role"] as AppRole | null) ?? null,
        };
      }
      return map;
    },
  });
}

/** Convenience wrapper returning only `id -> display name`. */
export function useProfileNames(ids: Array<string | null | undefined>) {
  const query = useProfileDirectory(ids);
  const map: Record<string, string> = {};
  for (const [id, summary] of Object.entries(query.data ?? {})) {
    map[id] = summary.name;
  }
  return { ...query, data: query.data ? map : undefined };
}

/** Extracts the ids whose profile role is `external`. */
export function externalIdSet(
  directory: Record<string, ProfileSummary> | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const [id, summary] of Object.entries(directory ?? {})) {
    if (summary.role === "external") set.add(id);
  }
  return set;
}
