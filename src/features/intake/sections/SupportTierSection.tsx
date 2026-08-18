import { Controller, useFormContext, useWatch } from "react-hook-form";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { recommendSupportTier } from "@/lib/calculation-engine";
import { formatCurrency } from "@/lib/utils";
import type { QuoteFormData, SupportTier } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";
import { FieldError } from "./FieldError";
import { RadioCardGroup } from "./RadioCardGroup";

const TIER_LABELS: Record<SupportTier, string> = {
  standard: "Standard",
  enhanced: "Enhanced",
  premium: "Premium",
};

/** Section 12 — support tier with an auto-recommendation the user may override. */
export function SupportTierSection() {
  const { control, formState } = useFormContext<QuoteFormData>();
  const { mode, showPricing } = useIntake();
  const { data: catalog = [] } = usePricingCatalog();

  const caseWorkers = useWatch({ control, name: "caseWorkerCount" }) ?? 0;
  const b2bUsers = useWatch({ control, name: "b2bUserCount" }) ?? 0;
  const recommended = recommendSupportTier(caseWorkers + b2bUsers);

  const priceFor = (tier: SupportTier) => {
    if (!showPricing) return "";
    const row = catalog.find((item) => item.sku_id === `support_${tier}`);
    return row ? ` — ${formatCurrency(row.unit_price)}/mo` : "";
  };

  const options = [
    {
      value: "standard",
      label: `Standard (≤100 users)${priceFor("standard")}`,
      description: "Business hours, 24-hour response",
    },
    {
      value: "enhanced",
      label: `Enhanced (101-300 users)${priceFor("enhanced")}`,
      description: "Extended hours, 4-hour response",
    },
    {
      value: "premium",
      label: `Premium (301+ users)${priceFor("premium")}`,
      description: "24/7, 1-hour response, dedicated CSM",
    },
  ];

  return (
    <SectionCard icon="🎧" title="Support Tier">
      <Controller
        control={control}
        name="supportTier"
        render={({ field }) => (
          <RadioCardGroup
            name="support-tier"
            value={field.value}
            onChange={field.onChange}
            options={options}
            disabled={mode === "readonly"}
          />
        )}
      />
      <span className="inline-flex rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
        💡 Recommended: {TIER_LABELS[recommended]} based on your user count.
      </span>
      <FieldError message={formState.errors.supportTier?.message} />
    </SectionCard>
  );
}
