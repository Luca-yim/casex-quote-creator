import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import { useVerticalLabels, OTHER_VERTICAL } from "@/hooks/useVerticalLabels";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";
import { RequiredLabel } from "./RequiredLabel";
import { FieldError } from "./FieldError";
import { RadioCardGroup } from "./RadioCardGroup";

/** Section 3 — vertical selection plus the solutions available within it. */
export function VerticalSolutionSection() {
  const { control, formState, setValue } = useFormContext<QuoteFormData>();
  const { mode, updateField } = useIntake();
  const disabled = mode === "readonly";
  const vertical = useWatch({ control, name: "vertical" });
  const { data: solutions = [], isLoading } = useVerticalSolutions();
  const { options: verticalOptions, isLoading: verticalsLoading } = useVerticalLabels();

  const isOther = vertical === OTHER_VERTICAL;
  const options = solutions.filter(
    (row) => row.vertical_l1 === vertical && row.is_active,
  );

  return (
    <SectionCard icon="🎯" title="Vertical & Solution">
      <div className="space-y-2">
        <Label>
          <RequiredLabel>Vertical</RequiredLabel>
        </Label>
        {verticalsLoading && verticalOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading verticals…</p>
        ) : verticalOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No verticals are available right now. Please refresh and try again.
          </p>
        ) : (
          <Controller
            control={control}
            name="vertical"
            render={({ field }) => (
              <RadioCardGroup
                name="vertical"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  // Programmatic resets must persist too, otherwise the quote
                  // keeps values that no longer belong to the vertical.
                  setValue("solution", "", { shouldDirty: true });
                  updateField("solution", "");
                  if (value !== OTHER_VERTICAL) {
                    setValue("verticalOtherDetail", null, { shouldDirty: true });
                    updateField("verticalOtherDetail", null);
                  }
                }}
                options={verticalOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                disabled={disabled}
                className="sm:grid-cols-2"
              />
            )}
          />
        )}
        <FieldError message={formState.errors.vertical?.message} />
      </div>

      {isOther ? (
        <div className="space-y-2">
          <Label htmlFor="verticalOtherDetail">
            <RequiredLabel>Please describe your area of need</RequiredLabel>
          </Label>
          <Controller
            control={control}
            name="verticalOtherDetail"
            render={({ field }) => (
              <Input
                id="verticalOtherDetail"
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value)}
                onBlur={field.onBlur}
                disabled={disabled}
                placeholder="e.g. permit inspections for a state agency"
              />
            )}
          />
          <FieldError message={formState.errors.verticalOtherDetail?.message} />
        </div>
      ) : (
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
                      !vertical
                        ? "Select a vertical first"
                        : isLoading
                          ? "Loading solutions…"
                          : options.length === 0
                            ? "No solutions available"
                            : "Select a solution"
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
      )}
    </SectionCard>
  );
}
