import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { quoteSchema, type QuoteFormData } from "@/types/quote";
import { useIntake } from "./IntakeContext";

type Section = { icon: string; title: string };

/** Ordered intake sections. Fields land in the next prompt. */
const SECTIONS: Section[] = [
  { icon: "🏢", title: "Customer Info" },
  { icon: "📅", title: "Target Go-Live Date" },
  { icon: "🧭", title: "Vertical & Solution" },
  { icon: "♻️", title: "Repeatable Activation" },
  { icon: "🛡️", title: "Compliance Requirements" },
  { icon: "🧱", title: "Module Tier" },
  { icon: "👥", title: "Case Workers" },
  { icon: "🌐", title: "B2C Portal" },
  { icon: "🏬", title: "B2B Portal" },
  { icon: "☁️", title: "Hosting" },
  { icon: "🔌", title: "Integrations" },
  { icon: "🛠️", title: "Support Tier" },
  { icon: "📈", title: "Rep Confidence" },
];

/**
 * Shared intake form used by every role. Section bodies are placeholders
 * for now; the form context is already wired so section components can
 * register fields in the next iteration.
 */
export function IntakeForm() {
  const { quote, mode } = useIntake();

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteSchema) as never,
    mode: "onBlur",
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

  return (
    <FormProvider {...form}>
      <form
        className="space-y-6"
        onSubmit={(event) => event.preventDefault()}
        aria-disabled={mode === "readonly"}
      >
        {SECTIONS.map((section) => (
          /* Section: {section.title} */
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span aria-hidden>{section.icon}</span> {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Fields coming in next prompt
              </p>
            </CardContent>
          </Card>
        ))}
      </form>
    </FormProvider>
  );
}
