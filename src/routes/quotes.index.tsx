import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SalesRepDashboard } from "@/components/dashboards/SalesRepDashboard";

export const Route = createFileRoute("/quotes/")({
  head: () => ({
    meta: [
      { title: "Quotes — CaseX Pricing Calculator" },
      { name: "description", content: "Track CaseXellence quotes from intake through approval." },
      { property: "og:title", content: "Quotes — CaseX Pricing Calculator" },
      { property: "og:description", content: "Track CaseXellence quotes from intake through approval." },
    ],
  }),
  component: QuotesPage,
});

function QuotesPage() {
  return (
    <ProtectedRoute allow={["sales_rep", "estimator", "admin"]}>
      <AppLayout title="Quotes" description="Your pipeline of CaseXellence quotes">
        <SalesRepDashboard />
      </AppLayout>
    </ProtectedRoute>
  );
}
