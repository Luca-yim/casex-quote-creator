import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";
import { NotificationsPage } from "@/pages/NotificationsPage";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — CaseX Pricing Calculator" },
      { name: "description", content: "Quote submissions, approvals and returns in one feed." },
      { property: "og:title", content: "Notifications — CaseX Pricing Calculator" },
      {
        property: "og:description",
        content: "Quote submissions, approvals and returns in one feed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsRoute,
});

function NotificationsRoute() {
  return (
    <AuthGate>
      <AppLayout title="Notifications" description="Everything that happened on your quotes">
        <NotificationsPage />
      </AppLayout>
    </AuthGate>
  );
}
