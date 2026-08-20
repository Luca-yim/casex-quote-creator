import { Link } from "@tanstack/react-router";
import { FileText, Clock3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesRepQuotes } from "@/features/quotes/useSalesRepQuotes";
import { ExternalQuoteRow } from "./ExternalQuoteRow";

export function ExternalDashboard() {
  // Same user-scoped query the rep dashboard uses; RLS limits it to own rows.
  const { data: quotes, isPending, isError, error } = useSalesRepQuotes();
  const list = quotes ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-brand">Request CaseXellence pricing ✨</CardTitle>
          <CardDescription>
            Answer 16 short questions about your agency and program. A Speridian estimator reviews
            every request before pricing is released.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/request-quote" search={{ start: true }}>
              Start intake
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FileText, title: "Submit intake", body: "~5 minutes, no pricing knowledge needed." },
          { icon: Clock3, title: "Estimator review", body: "The Sales team validates scope and effort." },
          { icon: ShieldCheck, title: "Approved quote", body: "Your rep sends a customer-ready PDF." },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader className="space-y-2">
              <Icon className="size-5 text-brand" />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your requests</CardTitle>
          <CardDescription>Open any request to review its details and status.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : isError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
              Could not load your requests:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No requests yet.
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {list.map((quote) => (
                <ExternalQuoteRow key={quote.id} quote={quote} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
