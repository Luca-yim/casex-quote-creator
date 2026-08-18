import { Controller, useFormContext } from "react-hook-form";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";
import { RadioCardGroup } from "./RadioCardGroup";

const OPTIONS = [
  {
    value: "full_match",
    label: "Full Match — 10% baseline reduction",
    description: "We've deployed this exact vertical+solution before",
  },
  {
    value: "partial_match",
    label: "Partial Match — 5% baseline reduction",
    description: "Similar vertical or solution deployed",
  },
  {
    value: "novel",
    label: "Novel — no adjustment",
    description: "New territory or bespoke solution",
  },
];

/** Section 4 — how much prior delivery work can be reused. */
export function RepeatableActivationSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();

  return (
    <SectionCard
      icon="♻️"
      title="Repeatable Activation"
      description="How much can we reuse from prior deployments? Estimator team validates during review."
    >
      <Controller
        control={control}
        name="repeatableActivation"
        render={({ field }) => (
          <RadioCardGroup
            name="repeatable-activation"
            value={field.value}
            onChange={field.onChange}
            options={OPTIONS}
            disabled={mode === "readonly"}
          />
        )}
      />
    </SectionCard>
  );
}
