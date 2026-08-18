import { Controller, useFormContext } from "react-hook-form";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";
import { RadioCardGroup } from "./RadioCardGroup";

const OPTIONS = [
  {
    value: "high",
    label: "High",
    description: "Requirements are clear and stakeholders aligned",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Some open questions but manageable",
  },
  { value: "low", label: "Low", description: "Significant unknowns" },
];

/** Section 13 — internal confidence signal. Hidden from external users. */
export function RepConfidenceSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode, role } = useIntake();

  if (role === "external") return null;

  return (
    <SectionCard icon="📊" title="Rep Confidence">
      <Controller
        control={control}
        name="repConfidence"
        render={({ field }) => (
          <RadioCardGroup
            name="rep-confidence"
            value={field.value}
            onChange={field.onChange}
            options={OPTIONS}
            disabled={mode === "readonly"}
            className="sm:grid-cols-3"
          />
        )}
      />
    </SectionCard>
  );
}
