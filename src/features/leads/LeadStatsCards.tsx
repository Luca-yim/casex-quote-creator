import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LEAD_STATUS_LABELS } from "./types";
import type { LeadStats } from "./useLeadStats";

const SHOWN = ["new_lead", "claimed", "qualified", "converted_to_ballpark"] as const;

/** Queue overview cards. Counts are unfiltered, mirroring the pipeline stats. */
export function LeadStatsCards({
  stats,
  isLoading,
}: {
  stats: LeadStats | undefined;
  isLoading: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {SHOWN.map((key) => (
        <Card key={key}>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {LEAD_STATUS_LABELS[key]}
            </p>
            {isLoading || !stats ? (
              <Skeleton className="mt-2 h-7 w-12" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums">{stats[key]}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
