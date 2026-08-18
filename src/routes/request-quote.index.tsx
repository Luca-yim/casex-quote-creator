import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useCreateDraftQuote } from "@/features/intake/useQuote";

export const Route = createFileRoute("/request-quote/")({
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
  const navigate = useNavigate();
  const createDraft = useCreateDraftQuote();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createDraft.mutate(undefined, {
      onSuccess: (quote) => {
        void navigate({
          to: "/request-quote/$id",
          params: { id: quote.id },
          replace: true,
        });
      },
    });
  }, [createDraft, navigate]);

  return (
    <ProtectedRoute allow={["external", "sales_rep", "estimator", "admin"]}>
      <AppLayout title="Request a quote" description="Starting a new intake">
        {createDraft.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not start a quote</AlertTitle>
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
