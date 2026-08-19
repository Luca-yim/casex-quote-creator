import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PipelinePage } from "@/features/pipeline/PipelinePage";
import { validatePipelineSearch } from "@/features/pipeline/search";

export const Route = createFileRoute("/pipeline")({
  validateSearch: validatePipelineSearch,
  head: () => ({
    meta: [
      { title: "Pipeline — CaseX Pricing Calculator" },
      {
        name: "description",
        content: "Read-only pipeline of approved CaseXellence quotes with stats, filters and PDF export.",
      },
      { property: "og:title", content: "Pipeline — CaseX Pricing Calculator" },
      {
        property: "og:description",
        content: "Read-only pipeline of approved CaseXellence quotes with stats, filters and PDF export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelineRoute,
});

function PipelineRoute() {
  // RLS (`estimator_reads_all_quotes`) is the primary control; this guard is
  // defense-in-depth and handles the redirect UX for other roles.
  return (
    <ProtectedRoute allow={["estimator", "admin"]}>
      <AppLayout title="Pipeline" description="Approved quotes across the system">
        <PipelinePage />
      </AppLayout>
    </ProtectedRoute>
  );
}
