import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { EstimatorDashboard } from "@/components/dashboards/EstimatorDashboard";

export const Route = createFileRoute("/review/")({
  head: () => ({
    meta: [
      { title: "Review queue — CaseX Pricing Calculator" },
      { name: "description", content: "Estimator queue for reviewing and approving CaseXellence pricing." },
      { property: "og:title", content: "Review queue — CaseX Pricing Calculator" },
      { property: "og:description", content: "Estimator queue for reviewing and approving CaseXellence pricing." },
    ],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  return (
    <ProtectedRoute allow={["estimator", "admin"]}>
      <AppLayout title="Review queue" description="Estimator workspace · full pricing visibility">
        <EstimatorDashboard />
      </AppLayout>
    </ProtectedRoute>
  );
}
