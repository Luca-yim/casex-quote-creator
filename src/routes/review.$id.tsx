import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { IntakePage } from "@/features/intake/IntakePage";

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
      <IntakePage
        quoteId={id}
        roleOverride="estimator"
        title="Estimator review"
        description="Full pricing detail and margin controls"
      />
    </ProtectedRoute>
  );
}
