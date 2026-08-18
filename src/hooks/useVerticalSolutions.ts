import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";

const FIVE_MINUTES = 5 * 60 * 1000;

export type VerticalSolution = Tables<"vertical_solutions">;

/** Fetches active vertical/solution pairs ordered for display. */
async function fetchVerticalSolutions(): Promise<VerticalSolution[]> {
  const { data, error } = await supabase
    .from("vertical_solutions")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** TanStack Query hook exposing vertical/solution options (5 min stale time). */
export function useVerticalSolutions() {
  return useQuery({
    queryKey: ["vertical-solutions"],
    queryFn: fetchVerticalSolutions,
    staleTime: FIVE_MINUTES,
  });
}
