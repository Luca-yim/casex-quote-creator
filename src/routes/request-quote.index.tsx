import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ExternalDashboard } from "@/components/dashboards/ExternalDashboard";

export const Route = createFileRoute("/request-quote/")({
  head: () => ({
    meta: [
      { title: "Request a quote — CaseX Pricing Calculator" },
      { name: "description", content: "Complete the CaseXellence intake to request pricing." },
      { property: "og:title", content: "Request a quote — CaseX Pricing Calculator" },
      { property: "og:description", content: "Complete the CaseXellence intake to request pricing." },
    ],
  }),
  component: RequestQuotePage,
});

function RequestQuotePage() {
  return (
    <ProtectedRoute allow={["external", "sales_rep", "estimator", "admin"]}>
      <AppLayout title="Request a quote" description="16-question intake · about 5 minutes">
        <ExternalDashboard />
      </AppLayout>
    </ProtectedRoute>
  );
}
