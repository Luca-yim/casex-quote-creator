import { Controller, useFormContext } from "react-hook-form";
import type { QuoteFormData } from "@/types/quote";
import { formatCurrency } from "@/lib/utils";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";
import { FieldError } from "./FieldError";
import { RadioCardGroup } from "./RadioCardGroup";

const STANDARD_PRICE = 735_000;
const ENTERPRISE_PRICE = 975_000;

/** Section 6 — module packaging tier. Prices only render for pricing roles. */
export function ModuleTierSection() {
  const { control, formState } = useFormContext<QuoteFormData>();
  const { mode, showPricing } = useIntake();

  const options = [
    {
      value: "standard",
      label: showPricing
        ? `Standard — ${formatCurrency(STANDARD_PRICE)} one-time`
        : "Standard",
      description: "Core CaseXellence platform",
    },
    {
      value: "enterprise",
      label: showPricing
        ? `Enterprise — ${formatCurrency(ENTERPRISE_PRICE)} one-time`
        : "Enterprise",
      description:
        "Includes advanced workflow, reporting, and integrations",
    },
  ];

  return (
    <SectionCard icon="📦" title="Module Tier">
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
