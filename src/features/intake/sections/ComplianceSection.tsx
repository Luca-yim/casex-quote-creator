import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Compliance, QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { AmberNote, SectionCard } from "./SectionCard";

const OPTIONS: Array<{ value: Compliance; label: string }> = [
  { value: "fedramp_moderate", label: "FedRAMP Moderate" },
  { value: "fedramp_high", label: "FedRAMP High" },
  { value: "soc2_type2", label: "SOC 2 Type II" },
  { value: "hipaa", label: "HIPAA" },
  { value: "cjis", label: "CJIS" },
  { value: "stateramp", label: "StateRAMP" },
  { value: "irs_1075", label: "IRS Publication 1075" },
];

/** Compliance regimes that force FedRAMP hosting. */
export const FEDRAMP_FORCING: Compliance[] = [
  "fedramp_high",
  "cjis",
  "irs_1075",
];

/** Section 5 — compliance requirements (multi-select). */
export function ComplianceSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";

  return (
    <SectionCard icon="🛡️" title="Compliance Requirements">
      <Controller
        control={control}
        name="compliance"
        render={({ field }) => {
          const selected: Compliance[] = field.value ?? [];
          const forcesFedramp = selected.some((item) =>
            FEDRAMP_FORCING.includes(item),
          );
          return (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {OPTIONS.map((option) => {
                  const id = `compliance-${option.value}`;
                  const checked = selected.includes(option.value);
                  return (
                    <div key={option.value} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(next) =>
                          field.onChange(
                            next
                              ? [...selected, option.value]
                              : selected.filter((v) => v !== option.value),
                          )
                        }
                      />
                      <Label htmlFor={id} className="font-normal">
                        {option.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
              {forcesFedramp ? (
                <AmberNote>
                  This compliance requirement forces FedRAMP hosting
                </AmberNote>
              ) : null}
            </div>
          );
        }}
      />
    </SectionCard>
  );
}
