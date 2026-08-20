import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { InfoNote, SectionCard } from "./SectionCard";
import { RadioCardGroup } from "./RadioCardGroup";
import { RequiredLabel } from "./RequiredLabel";
import { FieldError } from "./FieldError";

const DIFFICULTY = [
  {
    value: "simple",
    label: "Simple (API is well-documented, standard patterns)",
  },
  { value: "moderate", label: "Moderate (some custom mapping)" },
  { value: "complex", label: "Complex (bespoke work required)" },
  { value: "very_complex", label: "Very complex (unclear scope)" },
];

/** Section 11 — integration count and difficulty. */
export function IntegrationsSection() {
  const { control, formState } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";
  const hasIntegrations = useWatch({ control, name: "hasIntegrations" });

  return (
    <SectionCard icon="🔗" title="Integrations">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="has-integrations">
          Integrations with external systems
        </Label>
        <Controller
          control={control}
          name="hasIntegrations"
          render={({ field }) => (
            <Switch
              id="has-integrations"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </div>

      {hasIntegrations ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="integration-count">
              <RequiredLabel>How many integrations?</RequiredLabel>
            </Label>
            <Controller
              control={control}
              name="integrationCount"
              render={({ field }) => (
                <Input
                  id="integration-count"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                  aria-required="true"
                  disabled={disabled}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              )}
            />
            {formState.touchedFields.integrationCount ||
            formState.isSubmitted ? (
              <FieldError message={formState.errors.integrationCount?.message} />
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Integration difficulty</Label>
            <Controller
              control={control}
              name="integrationDifficulty"
              render={({ field }) => (
                <RadioCardGroup
                  name="integration-difficulty"
                  value={field.value}
                  onChange={field.onChange}
                  options={DIFFICULTY}
                  disabled={disabled}
                />
              )}
            />
          </div>
        </>
      ) : null}

      <InfoNote>
        Ballpark quotes assume onshore delivery ($225/hr). Configurable sourcing
        available in the Proposal tier.
      </InfoNote>
    </SectionCard>
  );
}
