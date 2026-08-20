import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useReviewQueue } from "@/features/review/useReviewQueue";
import { useQuoteHistory } from "@/features/review/useQuoteHistory";
import { useQuoteRealtimeSync } from "@/features/quotes/useQuoteRealtimeSync";
import { useProfileNames } from "@/hooks/useProfileNames";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { calculatePricingBreakdown } from "@/lib/calculation-engine";
import { QuoteTable } from "@/components/QuoteTable";
import type { QuoteRowData } from "@/lib/columns/quoteColumns";
import type { Quote } from "@/types/quote";

const QUEUE_COLUMNS = [
  "customer_name",
  "requested_by",
  "submitted_at",
  "vertical",
  "total_estimated_value",
  "state",
];

const HISTORY_COLUMNS = [
  "customer_name",
  "owner_id",
  "approved_at",
  "vertical",
  "total_estimated_value",
  "state",
];

function QuoteList({
  quotes,
  isPending,
  isError,
  error,
  emptyLabel,
  columns,
  profilesMap,
  onRowClick,
  defaultSortKey,
}: {
  quotes: QuoteRowData[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  emptyLabel: string;
  columns: string[];
  profilesMap: Record<string, string>;
  onRowClick: (row: QuoteRowData) => void;
  defaultSortKey: string;
}) {
  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Could not load quotes: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }
  return (
    <QuoteTable
      quotes={quotes}
      visibleColumns={columns}
      loading={isPending}
      emptyMessage={emptyLabel}
      profilesMap={profilesMap}
      onRowClick={onRowClick}
      defaultSort={{ key: defaultSortKey, direction: "desc" }}
    />
  );
}

export function EstimatorDashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const queue = useReviewQueue(role);
  const history = useQuoteHistory();
  const catalog = usePricingCatalog();

  useQuoteRealtimeSync({
    scope: { kind: "estimator" },
    queryKey: ["quotes", "review-queue"],
  });

  const rawList = queue.data ?? [];
  const rawHistory = history.data ?? [];
  const catalogRows = catalog.data ?? [];

  const withValue = (quotes: Quote[]): QuoteRowData[] =>
    quotes.map((quote) => ({
      ...quote,
      totalEstimatedValue: catalogRows.length
        ? calculatePricingBreakdown(quote, catalogRows).finalTCV
        : null,
    }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => withValue(rawList), [queue.data, catalog.data]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const historyList = useMemo(() => withValue(rawHistory), [history.data, catalog.data]);

  // Pre-fetch every referenced profile name once, instead of per cell.
  const profileIds = useMemo(
    () =>
      [...list, ...historyList].flatMap((q) => [
        q.requestedBy,
        q.ownerId,
        q.approvedBy,
      ]),
    [list, historyList],
  );
  const profiles = useProfileNames(profileIds);
  const profilesMap = profiles.data ?? {};

  const openQuote = (row: QuoteRowData) => {
    void navigate({ to: "/review/$id", params: { id: row.id } });
  };
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
                columns={QUEUE_COLUMNS}
                profilesMap={profilesMap}
                onRowClick={openQuote}
                defaultSortKey="submitted_at"
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
