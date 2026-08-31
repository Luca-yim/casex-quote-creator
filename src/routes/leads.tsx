import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LeadQueuePage } from "@/features/leads/LeadQueuePage";
import { validateLeadSearch } from "@/features/leads/search";

export const Route = createFileRoute("/leads")({
  validateSearch: validateLeadSearch,
  head: () => ({
    meta: [
      { title: "Lead Queue — CaseX Pricing Calculator" },
      {
        name: "description",
        content:
          "Triage inbound CaseXellence leads: claim, assign, qualify and de-duplicate public quote requests.",
      },
      { property: "og:title", content: "Lead Queue — CaseX Pricing Calculator" },
      {
        property: "og:description",
        content:
          "Triage inbound CaseXellence leads: claim, assign, qualify and de-duplicate public quote requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadsRoute,
});

function LeadsRoute() {
  // RLS (`internal_reads_leads`) is the primary control; this guard handles
  // redirect UX for external users.
  return (
    <ProtectedRoute allow={["sales_rep", "estimator", "admin"]}>
      <AppLayout title="Lead Queue" description="Inbound requests from the public quote form">
        <LeadQueuePage />
      </AppLayout>
    </ProtectedRoute>
  );
}
