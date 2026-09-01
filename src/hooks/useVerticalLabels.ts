import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";

const FIVE_MINUTES = 5 * 60 * 1000;

export type VerticalLabel = Tables<"vertical_labels">;

/** Special vertical value used when the customer's area of need isn't listed. */
export const OTHER_VERTICAL = "other";

/** Fetches the friendly vertical labels, ordered for display. */
async function fetchVerticalLabels(): Promise<VerticalLabel[]> {
  const { data, error } = await supabase
    .from("vertical_labels")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Vertical dropdown options sourced from `vertical_labels`. The `other`
 * row lives in the same table and is always sorted last.
 */
export function useVerticalLabels(options: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: ["vertical-labels"],
    queryFn: fetchVerticalLabels,
    staleTime: FIVE_MINUTES,
    enabled: options.enabled ?? true,
  });

  const rows = query.data ?? [];
  const options = [...rows]
    .sort((a, b) => {
      if (a.vertical_l1 === OTHER_VERTICAL) return 1;
      if (b.vertical_l1 === OTHER_VERTICAL) return -1;
      return a.display_order - b.display_order;
    })
    .map((row) => ({ value: row.vertical_l1, label: row.friendly_label }));

  return { ...query, options };
}
