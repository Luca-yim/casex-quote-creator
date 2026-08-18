import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCreateDraftQuote } from "@/features/intake/useQuote";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/quotes/new")({
  head: () => ({
    meta: [
      { title: "New quote — CaseX Pricing Calculator" },
      { name: "description", content: "Start a new CaseXellence quote intake as a sales rep." },
      { property: "og:title", content: "New quote — CaseX Pricing Calculator" },
      { property: "og:description", content: "Start a new CaseXellence quote intake as a sales rep." },
    ],
  }),
  component: NewQuotePage,
});

function NewQuotePage() {
  return (
    <ProtectedRoute allow={["sales_rep"]}>
      <AppLayout title="New quote" description="Creating a draft">
        <NewQuoteRunner />
      </AppLayout>
    </ProtectedRoute>
  );
}

/** Rendered only once AuthGate has confirmed both session and profile. */
function NewQuoteRunner() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const createDraft = useCreateDraftQuote({
    userId: user?.id,
    role,
    onSuccess: (quote) => {
      void navigate({ to: "/quotes/$id", params: { id: quote.id }, replace: true });
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
        <AlertTitle>Could not create the quote</AlertTitle>
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
