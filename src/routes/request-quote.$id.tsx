import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { IntakePage } from "@/features/intake/IntakePage";

export const Route = createFileRoute("/request-quote/$id")({
  head: () => ({
    meta: [
      { title: "Quote intake — CaseX Pricing Calculator" },
      { name: "description", content: "Fill in your CaseXellence requirements to receive pricing." },
      { property: "og:title", content: "Quote intake — CaseX Pricing Calculator" },
      { property: "og:description", content: "Fill in your CaseXellence requirements to receive pricing." },
    ],
  }),
  component: RequestQuoteIntakePage,
});

function RequestQuoteIntakePage() {
  const { id } = Route.useParams();
  return (
    <ProtectedRoute allow={["external", "sales_rep", "estimator", "admin"]}>
      <IntakePage
        quoteId={id}
        roleOverride="external"
        title="Request a quote"
        description="16-question intake · about 5 minutes"
      />
    </ProtectedRoute>
  );
}
