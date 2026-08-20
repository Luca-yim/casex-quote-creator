import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyQuotesTable } from "@/features/quotes/MyQuotesTable";
import { useMyQuotes, type MyQuotesTab } from "@/features/quotes/useMyQuotes";

export const Route = createFileRoute("/my-quotes")({
  // Tab lives in the URL so a refresh (or a shared link) restores the view.
  validateSearch: (search: Record<string, unknown>): { tab: MyQuotesTab } => ({
    tab: search["tab"] === "drafts" ? "drafts" : "submitted",
  }),
  head: () => ({
    meta: [
      { title: "My Quotes — CaseX Pricing Calculator" },
      { name: "description", content: "Track your submitted CaseXellence quotes and saved drafts." },
      { property: "og:title", content: "My Quotes — CaseX Pricing Calculator" },
      {
        property: "og:description",
        content: "Track your submitted CaseXellence quotes and saved drafts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyQuotesRoute,
});

function MyQuotesRoute() {
  return (
    <ProtectedRoute allow={["external", "sales_rep", "estimator", "admin"]}>
      <AppLayout title="My Quotes" description="Your submitted quotes and saved drafts">
        <MyQuotesPage />
      </AppLayout>
    </ProtectedRoute>
  );
}

function MyQuotesPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const query = useMyQuotes(tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everything you have requested, in one place.
        </p>
        <Button asChild>
          <Link to="/request-quote" search={{ start: true }}>
            New quote
          </Link>
        </Button>
      </div>

      <Tabs
        value={tab}
        onValueChange={(next) =>
          void navigate({ to: "/my-quotes", search: { tab: next as MyQuotesTab }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <MyQuotesTable
            tab={tab}
            quotes={query.data ?? []}
            isPending={query.isPending}
            isError={query.isError}
            error={query.error}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
