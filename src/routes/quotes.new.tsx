import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/quotes/new")({
  head: () => ({
    meta: [
      { title: "New quote — CaseX Pricing Calculator" },
      { name: "description", content: "Start a new CaseXellence quote intake as a sales rep." },
      { property: "og:title", content: "New quote — CaseX Pricing Calculator" },
      { property: "og:description", content: "Start a new CaseXellence quote intake as a sales rep." },
    ],
  }),
  component: NewQuotePage,
});

function NewQuotePage() {
  return (
    <ProtectedRoute allow={["sales_rep", "estimator", "admin"]}>
      <AppLayout title="New quote" description="Sales rep intake">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Intake questionnaire</CardTitle>
            <CardDescription>
              The 16-question Ballpark questionnaire plugs in here next.
            </CardDescription>
          </CardHeader>
          <CardContent className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            Questionnaire coming soon.
          </CardContent>
        </Card>
      </AppLayout>
    </ProtectedRoute>
  );
}
