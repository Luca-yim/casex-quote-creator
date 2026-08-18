import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useReviewQueue } from "@/features/review/useReviewQueue";
import { STATE_LABELS } from "@/lib/quote-workflow";

function relativeDays(iso: string | null) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return `${days}d ago`;
}

export function EstimatorDashboard() {
  const { role } = useAuth();
  const { data: quotes, isPending, isError, error } = useReviewQueue(role);

  const list = quotes ?? [];
  const awaiting = list.filter((q) => q.state === "submitted_for_review").length;
  const inProgress = list.filter(
    (q) => q.state === "under_review" || q.state === "estimator_adjusted",
  ).length;

  const stats = [
    { label: "Awaiting review", value: isPending ? "…" : String(awaiting) },
    { label: "In progress", value: isPending ? "…" : String(inProgress) },
    { label: "Queue total", value: isPending ? "…" : String(list.length) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="font-mono text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review queue 🧮</CardTitle>
          <CardDescription>
            Full pricing visibility. Adjust rates and approve quotes before they reach the customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
              Could not load the review queue: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
              Nothing to review yet.
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {list.map((quote) => (
                <li
                  key={quote.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {quote.customerName || quote.name || "Untitled quote"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[quote.vertical, quote.solution].filter(Boolean).join(" · ") ||
                        "No vertical selected"}
                      {" · submitted "}
                      {relativeDays(quote.submittedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{STATE_LABELS[quote.state]}</Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/review/$id" params={{ id: quote.id }}>
                        Review <ArrowRight className="ml-1 size-4" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
