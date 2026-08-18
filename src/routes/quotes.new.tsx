import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  const navigate = useNavigate();
  const { loading, user, profile, role } = useAuth();
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const createDraft = useCreateDraftQuote({
    userId: user?.id,
    role,
    onSuccess: (quote) => {
      void navigate({ to: "/quotes/$id", params: { id: quote.id }, replace: true });
    },
  });
  const { mutate } = createDraft;
  const started = useRef(false);
  // Warm catalog data while the draft insert is in flight.
  usePricingCatalog();
  useVerticalSolutions();

  useEffect(() => {
    if (loading || !user || !profile || !role || started.current) return;
    console.log("[quote-create] auth user:", user);
    console.log("[quote-create] profile:", profile);
    started.current = true;
    mutate();
  }, [loading, user, profile, role, mutate]);

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      const message = !user ? "You must be signed in to create a quote." : "Your profile could not be loaded.";
      setReadinessError(message);
      toast.error("Could not create the quote", { description: message });
      return;
    }
    const timeoutId = window.setTimeout(() => {
      if (started.current) return;
      const message = "Your account took too long to load. Please refresh and try again.";
      setReadinessError(message);
      toast.error("Could not create the quote", { description: message });
    }, 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [loading, user, profile]);

  return (
    <ProtectedRoute allow={["sales_rep"]}>
      <AppLayout title="New quote" description="Creating a draft">
        {createDraft.isError || readinessError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not create the quote</AlertTitle>
            <AlertDescription>
              {readinessError ?? (createDraft.error instanceof Error
                ? createDraft.error.message
                : "Please try again.")}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Creating your quote...</p>
          </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
