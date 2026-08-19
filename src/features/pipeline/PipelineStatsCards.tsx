import { Briefcase, CheckCircle2, Clock, Percent, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { STATS_CAP, type PipelineStats } from "./usePipelineStats";

/** Picks days vs. hours based on magnitude. */
function formatApprovalTime(hours: number | null): string {
  if (hours === null) return "—";
  if (hours >= 48) return `${(hours / 24).toFixed(1)} days`;
  return `${hours.toFixed(hours < 10 ? 1 : 0)} hours`;
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span
          className={
            tone === "positive"
              ? "mt-0.5 text-emerald-600"
              : tone === "negative"
                ? "mt-0.5 text-destructive"
                : "mt-0.5 text-muted-foreground"
          }
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="font-mono text-xl font-semibold tracking-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Five summary cards that always reflect the currently applied filters. */
export function PipelineStatsCards({
  stats,
  isLoading,
}: {
  stats: PipelineStats | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const closed = stats.wonCount + stats.lostCount;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="In pipeline"
          value={String(stats.inPipelineCount)}
          sub={`${formatCurrency(stats.inPipelineTcv, { compact: true })} total value`}
          icon={<Briefcase className="size-4" />}
        />
        <StatCard
          label="Won"
          value={String(stats.wonCount)}
          sub={`${formatCurrency(stats.wonTcv, { compact: true })} total value`}
          icon={<CheckCircle2 className="size-4" />}
          tone="positive"
        />
        <StatCard
          label="Lost"
          value={String(stats.lostCount)}
          sub={`${formatCurrency(stats.lostTcv, { compact: true })} total value`}
          icon={<XCircle className="size-4" />}
          tone="negative"
        />
        <StatCard
          label="Win rate"
          value={stats.winRate === null ? "—" : `${stats.winRate.toFixed(0)}%`}
          sub={`based on ${closed} closed deal${closed === 1 ? "" : "s"}`}
          icon={<Percent className="size-4" />}
        />
        <StatCard
          label="Median approval time"
          value={formatApprovalTime(stats.medianApprovalHours)}
          sub={`across ${stats.approvalSampleSize} quote${stats.approvalSampleSize === 1 ? "" : "s"}`}
          icon={<Clock className="size-4" />}
        />
      </div>
      {stats.capReached ? (
        <p className="text-xs text-muted-foreground">
          Based on first {STATS_CAP.toLocaleString()} quotes matching filters.
        </p>
      ) : null}
    </div>
  );
}
