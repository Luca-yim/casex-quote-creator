import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useReviewQueue } from "@/features/review/useReviewQueue";
import { useQuoteHistory } from "@/features/review/useQuoteHistory";
import { useQuoteRealtimeSync } from "@/features/quotes/useQuoteRealtimeSync";
import { EstimatorQuoteRow } from "./EstimatorQuoteRow";
import type { Quote } from "@/types/quote";

function QuoteList({
  quotes,
  isPending,
  isError,
  error,
  emptyLabel,
}: {
  quotes: Quote[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  emptyLabel: string;
}) {
  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Could not load quotes: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }
  if (quotes.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {quotes.map((quote) => (
        <EstimatorQuoteRow key={quote.id} quote={quote} />
      ))}
    </ul>
  );
}

export function EstimatorDashboard() {
  const { role } = useAuth();
  const queue = useReviewQueue(role);
  const history = useQuoteHistory();

  useQuoteRealtimeSync({
    scope: { kind: "estimator" },
    queryKey: ["quotes", "review-queue"],
  });

  const list = queue.data ?? [];
  const historyList = history.data ?? [];
  const awaiting = list.filter((q) => q.state === "submitted_for_review").length;
  const inProgress = list.filter(
    (q) => q.state === "under_review" || q.state === "estimator_adjusted",
  ).length;

  const stats = [
    { label: "Awaiting review", value: queue.isPending ? "…" : String(awaiting) },
    { label: "In progress", value: queue.isPending ? "…" : String(inProgress) },
    { label: "Queue total", value: queue.isPending ? "…" : String(list.length) },
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
          <Tabs defaultValue="queue" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="queue" className="gap-2">
                Queue
                <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                  {list.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                History
                <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                  {historyList.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="queue">
              <QuoteList
                quotes={list}
                isPending={queue.isPending}
                isError={queue.isError}
                error={queue.error}
                emptyLabel="Nothing to review yet."
              />
            </TabsContent>
            <TabsContent value="history">
              <QuoteList
                quotes={historyList}
                isPending={history.isPending}
                isError={history.isError}
                error={history.error}
                emptyLabel="No approved or closed quotes yet."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
