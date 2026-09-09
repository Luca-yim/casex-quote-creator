import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { InfoNote, SectionCard } from "./SectionCard";
import { RadioCardGroup } from "./RadioCardGroup";
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

/** Section 11 — a repeatable list of integrations, each with its own difficulty. */
export function IntegrationsSection() {
  const { control, formState } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";
  const hasIntegrations = useWatch({ control, name: "hasIntegrations" });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "integrations",
  });

  const showError =
    formState.touchedFields.integrations || formState.isSubmitted;
  const listError = (
    formState.errors.integrations as { message?: string } | undefined
  )?.message;

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
        <div className="space-y-4">
          {fields.map((row, index) => (
            <div key={row.id} className="space-y-2 rounded-md border p-4">
              <div className="flex items-center justify-between gap-4">
                <Label>Integration {index + 1}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => remove(index)}
                  aria-label={`Remove integration ${index + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove
                </Button>
              </div>
              <Controller
                control={control}
                name={`integrations.${index}.difficulty` as const}
                render={({ field }) => (
                  <RadioCardGroup
                    name={`integration-difficulty-${index}`}
                    value={field.value}
                    onChange={field.onChange}
                    options={DIFFICULTY}
                    disabled={disabled}
                  />
                )}
              />
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              append({ difficulty: undefined as never }, { shouldFocus: false })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add integration
          </Button>

          {showError ? <FieldError message={listError} /> : null}
        </div>
      ) : null}

      <InfoNote>
        Ballpark quotes assume onshore delivery ($225/hr). Configurable sourcing
        available in the Proposal tier.
      </InfoNote>
    </SectionCard>
  );
}
