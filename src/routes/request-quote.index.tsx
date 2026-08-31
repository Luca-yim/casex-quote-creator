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
  return (
    <ProtectedRoute allow={["external", "sales_rep"]}>
      <RequestQuoteEntry />
    </ProtectedRoute>
  );
}

/** Rendered once AuthGate + RoleGate have settled, so `role` is known. */
function RequestQuoteEntry() {
  const { start, tab } = Route.useSearch();
  const navigate = useNavigate();
  const { role } = useAuth();
  // External requesters now create work through the public lead-intake flow
  // (`/get-a-quote`), so `?start=1` never spawns a draft quote for them — it
  // just falls through to their dashboard. Sales reps keep the branch.
  const startIntake = Boolean(start) && role !== "external";

  return (
    <>
      {startIntake ? (
        <AppLayout title="Request a quote" description="Starting a new intake">
          <RequestQuoteRunner />
        </AppLayout>
      ) : (
        <AppLayout
          title="My Quotes"
          description="Track submitted requests and pick up where you left off. A Speridian estimator reviews every request before pricing is released."
        >
          <ExternalDashboard
            tab={tab ?? "submitted"}
            onTabChange={(next) =>
              void navigate({
                to: "/request-quote",
                search: next === "drafts" ? { tab: "drafts" } : {},
                replace: true,
              })
            }
          />
        </AppLayout>
      )}
    </>
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
