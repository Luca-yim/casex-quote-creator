import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";
import { RequiredLabel } from "./RequiredLabel";
import { FieldError } from "./FieldError";
import { RadioCardGroup } from "./RadioCardGroup";

const VERTICALS = [
  { value: "FAMCx", label: "FAMCx", description: "Family Cx" },
  { value: "HealthCx", label: "HealthCx", description: "Health Cx" },
  { value: "JusticeCx", label: "JusticeCx", description: "Justice Cx" },
  { value: "GovCx", label: "GovCx", description: "Government Cx" },
];

/** Section 3 — vertical selection plus the solutions available within it. */
export function VerticalSolutionSection() {
  const { control, formState, setValue } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";
  const vertical = useWatch({ control, name: "vertical" });
  const { data: solutions = [], isLoading } = useVerticalSolutions();

  const options = solutions.filter((row) => row.vertical_l1 === vertical);

  return (
    <SectionCard icon="🎯" title="Vertical & Solution">
      <div className="space-y-2">
        <Label>
          <RequiredLabel>Vertical</RequiredLabel>
        </Label>
        <Controller
          control={control}
          name="vertical"
          render={({ field }) => (
            <RadioCardGroup
              name="vertical"
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                setValue("solution", "", { shouldDirty: true });
              }}
              options={VERTICALS}
              disabled={disabled}
              className="sm:grid-cols-2"
            />
          )}
        />
        <FieldError message={formState.errors.vertical?.message} />
      </div>

      <div className="space-y-2">
        <Label>
          <RequiredLabel>Solution</RequiredLabel>
        </Label>
        <Controller
          control={control}
          name="solution"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled || !vertical || isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    vertical ? "Select a solution" : "Select a vertical first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((row) => (
                  <SelectItem key={row.id} value={row.solution_l2}>
                    {row.display_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={formState.errors.solution?.message} />
      </div>
    </SectionCard>
  );
}
