import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/review/$id")({
  head: () => ({
    meta: [
      { title: "Review quote — CaseX Pricing Calculator" },
      { name: "description", content: "Adjust and approve pricing for a submitted CaseXellence intake." },
      { property: "og:title", content: "Review quote — CaseX Pricing Calculator" },
      { property: "og:description", content: "Adjust and approve pricing for a submitted CaseXellence intake." },
    ],
  }),
  component: ReviewDetailPage,
});

function ReviewDetailPage() {
  const { id } = Route.useParams();
  return (
    <ProtectedRoute allow={["estimator", "admin"]}>
      <AppLayout title="Review quote" description={`Reference ${id}`}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estimator review</CardTitle>
            <CardDescription>
              Pricing adjustments, margin controls and approval actions go here.
            </CardDescription>
          </CardHeader>
          <CardContent className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
            Review interface coming soon.
          </CardContent>
        </Card>
      </AppLayout>
    </ProtectedRoute>
  );
}
