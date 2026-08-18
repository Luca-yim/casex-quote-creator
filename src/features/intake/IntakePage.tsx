import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth, type AppRole } from "@/lib/auth";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import { IntakeProvider, computeShowPricing } from "./IntakeContext";
import { IntakeForm } from "./IntakeForm";
import { useQuoteById } from "./useQuote";
import { PricingSidebar } from "@/features/pricing-sidebar/PricingSidebar";
import type { Quote } from "@/types/quote";

export interface IntakePageProps {
  quoteId: string;
  /** Role context for this route; defaults to the signed-in user's role. */
  roleOverride?: AppRole;
  mode?: "edit" | "readonly";
  title?: string;
  description?: string;
}

/** Page shell for the shared intake experience. */
export function IntakePage({
  quoteId,
  roleOverride,
  mode = "edit",
  title = "Quote intake",
  description = "",
}: IntakePageProps) {
  const { role: authRole } = useAuth();
  const role: AppRole = roleOverride ?? authRole ?? "external";

  const quoteQuery = useQuoteById(quoteId);
  const catalogQuery = usePricingCatalog();
  const verticalsQuery = useVerticalSolutions();

  const [isSaving] = useState(false);
  const [lastSavedAt] = useState<Date | null>(null);

  const quote = quoteQuery.data as Quote | undefined;

  const contextValue = useMemo(() => {
    if (!quote) return null;
    return {
      quoteId,
      quote,
      role,
      mode,
      showPricing: computeShowPricing(role, quote.state),
      updateField: (_path: string, _value: unknown) => {
        /* Auto-save wiring lands in Prompt G. */
      },
      isSaving,
      lastSavedAt,
      validationErrors: {} as Record<string, string>,
    };
  }, [quote, quoteId, role, mode, isSaving, lastSavedAt]);

  // Only the quote blocks the first paint; catalog/verticals stream in behind it.
  const loading = quoteQuery.isLoading;

  if (loading) {
    return (
      <AppLayout title={title} description={description}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (quoteQuery.isError || !contextValue) {
    return (
      <AppLayout title={title} description={description}>
        <Alert variant="destructive">
          <AlertTitle>Quote unavailable</AlertTitle>
          <AlertDescription>
            {quoteQuery.error instanceof Error
              ? quoteQuery.error.message
              : "This quote could not be found, or you do not have access to it."}
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={title} description={description || contextValue.quote.name}>
      <IntakeProvider value={contextValue}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <IntakeForm />
          </div>
          <aside className="lg:col-span-2">
            <div className="lg:sticky lg:top-24">
              <PricingSidebar />
            </div>
          </aside>
        </div>
      </IntakeProvider>
    </AppLayout>
  );
}
