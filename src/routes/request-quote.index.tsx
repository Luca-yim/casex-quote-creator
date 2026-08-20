import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalDashboard } from "@/components/dashboards/ExternalDashboard";
import { useCreateDraftQuote } from "@/features/intake/useQuote";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/request-quote/")({
  // `?start=1` is the explicit "create a new intake" entry point. Without it
  // this route is the external user's home, so returning here (e.g. from the
  // confirmation page) never spawns an empty draft.
  validateSearch: (
    search: Record<string, unknown>,
  ): { start?: true; tab?: "submitted" | "drafts" } => {
    const raw = search["start"];
    const start = raw === true || raw === "1" || raw === "true";
    const tab = search["tab"] === "drafts" ? ("drafts" as const) : undefined;
    return { ...(start ? { start: true as const } : {}), ...(tab ? { tab } : {}) };
  },
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
  const { start } = Route.useSearch();

  return (
    <ProtectedRoute allow={["external", "sales_rep"]}>
      {start ? (
        <AppLayout title="Request a quote" description="Starting a new intake">
          <RequestQuoteRunner />
        </AppLayout>
      ) : (
        <AppLayout title="My requests" description="Track your CaseXellence pricing requests">
          <ExternalDashboard />
        </AppLayout>
      )}
    </ProtectedRoute>
  );
}

/** Rendered only once AuthGate has confirmed both session and profile. */
function RequestQuoteRunner() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const createDraft = useCreateDraftQuote({
    userId: user?.id,
    role,
    onSuccess: (quote) => {
      void navigate({ to: "/request-quote/$id", params: { id: quote.id }, replace: true });
    },
  });
  const { mutate } = createDraft;
  const started = useRef(false);
  usePricingCatalog();
  useVerticalSolutions();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate();
  }, [mutate]);

  if (createDraft.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not start a quote</AlertTitle>
        <AlertDescription>
          {createDraft.error instanceof Error ? createDraft.error.message : "Please try again."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">Creating your quote...</p>
    </div>
  );
}
