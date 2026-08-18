import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCreateDraftQuote } from "@/features/intake/useQuote";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";

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
  const navigate = useNavigate();
  const createDraft = useCreateDraftQuote();
  const { mutateAsync, data: createdQuote } = createDraft;
  const started = useRef(false);
  // Warm catalog data while the draft insert is in flight.
  usePricingCatalog();
  useVerticalSolutions();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutateAsync(undefined).catch(() => {});
  }, [mutateAsync]);

  useEffect(() => {
    if (!createdQuote) return;
    void navigate({
      to: "/quotes/$id",
      params: { id: createdQuote.id },
      replace: true,
    });
  }, [createdQuote, navigate]);

  return (
    <ProtectedRoute allow={["sales_rep", "estimator", "admin"]}>
      <AppLayout title="New quote" description="Creating a draft">
        {createDraft.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not create the quote</AlertTitle>
            <AlertDescription>
              {createDraft.error instanceof Error
                ? createDraft.error.message
                : "Please try again."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
