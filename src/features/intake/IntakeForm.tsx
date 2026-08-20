import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { quoteSchema, type QuoteFormData } from "@/types/quote";
import { useIntake } from "./IntakeContext";
import { CustomerInfoSection } from "./sections/CustomerInfoSection";
import { TargetGoLiveSection } from "./sections/TargetGoLiveSection";
import { VerticalSolutionSection } from "./sections/VerticalSolutionSection";
import { RepeatableActivationSection } from "./sections/RepeatableActivationSection";
import { ComplianceSection } from "./sections/ComplianceSection";
import { ModuleTierSection } from "./sections/ModuleTierSection";
import { CaseWorkerSection } from "./sections/CaseWorkerSection";
import { B2cPortalSection } from "./sections/B2cPortalSection";
import { B2bPortalSection } from "./sections/B2bPortalSection";
import { HostingSection } from "./sections/HostingSection";
import { IntegrationsSection } from "./sections/IntegrationsSection";
import { SupportTierSection } from "./sections/SupportTierSection";
import { RepConfidenceSection } from "./sections/RepConfidenceSection";
import { SubmitBar } from "./SubmitBar";
import { ReturnedNoteCallout } from "./ReturnedNoteCallout";

/**
 * Fields that render with a pre-selected default in the UI. If the stored
 * quote has no value for them, the default is persisted on mount so the
 * progress indicator counts them as complete.
 */
const PRESELECTED_DEFAULT_FIELDS = [
  "contractYears",
  "repeatableActivation",
  "environmentCount",
  "marginPercent",
  "tier",
] as const;

/**
 * Shared intake form used by every role. Each of the 13 sections reads and
 * writes through the shared react-hook-form context.
 */
export function IntakeForm() {
  const { quote, mode, updateField } = useIntake();

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema) as never,
    mode: "onTouched",
    defaultValues: {
      name: quote.name,
      customerName: quote.customerName ?? "",
      customerEmail: quote.customerEmail,
      customerType: quote.customerType ?? undefined,
      compliance: quote.compliance,
      vertical: quote.vertical ?? "",
      solution: quote.solution ?? "",
      repeatableActivation: quote.repeatableActivation,
      moduleTier: quote.moduleTier ?? undefined,
      contractYears: quote.contractYears,
      targetGoLiveDate: quote.targetGoLiveDate,
      caseWorkerCount: quote.caseWorkerCount,
      includeB2c: quote.includeB2c,
      b2cMau: quote.b2cMau,
      includeB2bPortal: quote.includeB2bPortal,
      b2bUserCount: quote.b2bUserCount,
      hostingModel: quote.hostingModel ?? undefined,
      environmentCount: quote.environmentCount,
      hasIntegrations: quote.hasIntegrations,
      integrationCount: quote.integrationCount,
      integrationDifficulty: quote.integrationDifficulty,
      supportTier: quote.supportTier ?? undefined,
      marginPercent: quote.marginPercent,
      marginJustification: quote.marginJustification,
      repConfidence: quote.repConfidence,
      tier: quote.tier,
    } as Partial<QuoteFormData> as QuoteFormData,
  });

  // Pre-selected defaults (radios/dropdowns that render with a value) must
  // count toward progress immediately, so push them into the quote on mount
  // whenever the stored quote has no value for that field yet.
  const { getValues } = form;
  useEffect(() => {
    if (mode === "readonly") return;
    const values = getValues();
    for (const field of PRESELECTED_DEFAULT_FIELDS) {
      const stored = (quote as unknown as Record<string, unknown>)[field];
      const formValue = (values as unknown as Record<string, unknown>)[field];
      const storedEmpty =
        stored === null || stored === undefined || stored === "";
      const formFilled =
        formValue !== null && formValue !== undefined && formValue !== "";
      if (storedEmpty && formFilled) {
        updateField(field, formValue);
      }
    }
    // Mount-only sync: later changes flow through the watch subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every field change auto-saves; invalid drafts still persist.
  const readonly = mode === "readonly";
  const { watch } = form;
  useEffect(() => {
    if (readonly) return;
    const subscription = watch((_values, { name, type }) => {
      if (!name || type !== "change") return;
      updateField(name, form.getValues(name as never));
    });
    return () => subscription.unsubscribe();
  }, [watch, form, updateField, readonly]);

  return (
    <FormProvider {...form}>
      <form
        className="space-y-6"
        onSubmit={(event) => event.preventDefault()}
        aria-disabled={mode === "readonly"}
      >
        <p className="text-xs text-muted-foreground">
          Fields marked with{" "}
          <span className="text-destructive" aria-hidden>
            *
          </span>{" "}
          are required.
        </p>
        <ReturnedNoteCallout />
        <CustomerInfoSection />
        <TargetGoLiveSection />
        <VerticalSolutionSection />
        <RepeatableActivationSection />
        <ComplianceSection />
        <ModuleTierSection />
        <CaseWorkerSection />
        <B2cPortalSection />
        <B2bPortalSection />
        <HostingSection />
        <IntegrationsSection />
        <SupportTierSection />
        <RepConfidenceSection />
        <SubmitBar />
      </form>
    </FormProvider>
  );
}
