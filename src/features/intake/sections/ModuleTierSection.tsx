import { Controller, useFormContext, useWatch } from "react-hook-form";
import type { QuoteFormData } from "@/types/quote";
import { formatCurrency } from "@/lib/utils";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";
import { FieldError } from "./FieldError";
import { RadioCardGroup } from "./RadioCardGroup";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";

/** Section 6 — module packaging tier. Prices only render for pricing roles. */
export function ModuleTierSection() {
  const { control, formState } = useFormContext<QuoteFormData>();
  const { mode, showPricing } = useIntake();
  const { data: catalog = [] } = usePricingCatalog();
  const customerType = useWatch({ control, name: "customerType" });
  const useNaspoDiscount = customerType === "state_naspo";

  const priceFor = (skuId: string) => {
    if (!showPricing) return "";
    const row = catalog.find((item) => item.sku_id === skuId);
    if (!row) return "";
    const price =
      useNaspoDiscount && row.naspo_discount_price != null
        ? row.naspo_discount_price
        : row.unit_price;
    return ` — ${formatCurrency(price)} one-time`;
  };

  const options = [
    {
      value: "standard",
      label: `Standard${priceFor("module_standard")}`,
      description: "Core CaseXellence platform",
    },
    {
      value: "enterprise",
      label: `Enterprise${priceFor("module_enterprise")}`,
      description:
        "Includes advanced workflow, reporting, and integrations",
    },
  ];

  return (
    <SectionCard icon="📦" title="Module Tier" required>
      <Controller
        control={control}
        name="moduleTier"
        render={({ field }) => (
          <RadioCardGroup
            name="module-tier"
            value={field.value}
            onChange={field.onChange}
            options={options}
            disabled={mode === "readonly"}
            className="sm:grid-cols-2"
          />
        )}
      />
      <FieldError message={formState.errors.moduleTier?.message} />
    </SectionCard>
  );
}
