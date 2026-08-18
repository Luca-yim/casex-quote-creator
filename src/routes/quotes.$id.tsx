import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { IntakePage } from "@/features/intake/IntakePage";

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
      <IntakePage quoteId={id} roleOverride="sales_rep" title="Quote intake" />
    </ProtectedRoute>
  );
}
