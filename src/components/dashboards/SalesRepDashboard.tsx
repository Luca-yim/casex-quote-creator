import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSalesRepQuotes } from "@/features/quotes/useSalesRepQuotes";
import { useQuoteRealtimeSync } from "@/features/quotes/useQuoteRealtimeSync";
import { useAuth } from "@/lib/auth";
import { SalesRepQuoteRow } from "./SalesRepQuoteRow";
import { useProfileDirectory, externalIdSet } from "@/hooks/useProfileNames";
import type { QuoteState } from "@/types/quote";

const TABS: { id: string; label: string; states: QuoteState[] }[] = [
  { id: "drafts", label: "Drafts", states: ["draft", "estimator_adjusted"] },
  { id: "under-review", label: "Under Review", states: ["submitted_for_review", "under_review"] },
  { id: "approved", label: "Approved", states: ["approved"] },
  { id: "sent", label: "Sent", states: ["sent_to_customer"] },
  { id: "closed", label: "Closed", states: ["accepted", "declined", "archived"] },
];

export function SalesRepDashboard() {
  const { user } = useAuth();
  const { data: quotes, isPending, isError, error } = useSalesRepQuotes();

  useQuoteRealtimeSync({
    scope: { kind: "sales_rep", userId: user?.id },
    queryKey: ["quotes", "sales-rep", user?.id],
  });

  const list = quotes ?? [];
  const requesterProfiles = useProfileDirectory(list.map((q) => q.requestedBy));
  const externalUserIds = externalIdSet(requesterProfiles.data);
  const counts = TABS.map((tab) => ({
    ...tab,
    count: list.filter((q) => tab.states.includes(q.state)).length,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total quotes", value: isPending ? "…" : String(list.length) },
          { label: "Approved & ready", value: isPending ? "…" : String(counts.find((c) => c.id === "approved")?.count ?? 0) },
          { label: "Awaiting review", value: isPending ? "…" : String(counts.find((c) => c.id === "under-review")?.count ?? 0) },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="font-mono text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Quotes 📋</CardTitle>
            <CardDescription>Pricing stays hidden until an estimator approves.</CardDescription>
          </div>
          <Button asChild size="sm">
            <Link to="/quotes/new">
              <Plus className="mr-1 size-4" /> New quote
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
              Could not load quotes: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : (
            <Tabs defaultValue="approved" className="w-full">
              <TabsList className="flex flex-wrap h-auto gap-1">
                {counts.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                    {tab.label}
                    <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                      {tab.count}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
              {counts.map((tab) => {
                const tabQuotes = list.filter((q) => tab.states.includes(q.state));
                return (
                  <TabsContent key={tab.id} value={tab.id}>
                    {tabQuotes.length === 0 ? (
                      <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                        No {tab.label.toLowerCase()} quotes.
                      </div>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {tabQuotes.map((quote) => (
                          <SalesRepQuoteRow
                            key={quote.id}
                            quote={quote}
                            isExternalRequest={externalUserIds.has(quote.requestedBy)}
                          />
                        ))}
                      </ul>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
