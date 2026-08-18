import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/quotes/$id")({
  head: () => ({
    meta: [
      { title: "Quote detail — CaseX Pricing Calculator" },
      { name: "description", content: "Review a single CaseXellence quote and its approval status." },
      { property: "og:title", content: "Quote detail — CaseX Pricing Calculator" },
      { property: "og:description", content: "Review a single CaseXellence quote and its approval status." },
    ],
  }),
  component: QuoteDetailPage,
});

function QuoteDetailPage() {
  const { id } = Route.useParams();
  return (
    <ProtectedRoute allow={["sales_rep", "estimator", "admin"]}>
      <AppLayout title="Quote detail" description={`Reference ${id}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quote {id}</CardTitle>
            <CardDescription>Intake answers, status timeline and pricing land here.</CardDescription>
          </CardHeader>
          <CardContent className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nothing to show yet.
          </CardContent>
        </Card>
      </AppLayout>
    </ProtectedRoute>
  );
}
