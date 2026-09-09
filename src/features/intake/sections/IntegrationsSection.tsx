import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { IntegrationItem, QuoteFormData } from "@/types/quote";
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
  const { mode, updateField } = useIntake();
  const disabled = mode === "readonly";
  const hasIntegrations = useWatch({ control, name: "hasIntegrations" });
  const integrationsValue = (useWatch({ control, name: "integrations" }) ??
    []) as IntegrationItem[];
  const { fields, append, remove } = useFieldArray({
    control,
    name: "integrations",
  });

  const showError =
    formState.touchedFields.integrations || formState.isSubmitted;
  const listError = (
    formState.errors.integrations as { message?: string } | undefined
  )?.message;

  const handleAppend = () => {
    const newRow = { difficulty: undefined as never };
    append(newRow, { shouldFocus: false });
    // useFieldArray's structural mutations (append/remove) never emit a RHF
    // "change" watch event, so IntakeForm's global watch subscription never
    // sees this — push the resulting array explicitly.
    updateField("integrations", [...integrationsValue, newRow]);
  };

  const handleRemove = (index: number) => {
    remove(index);
    updateField(
      "integrations",
      integrationsValue.filter((_, i) => i !== index),
    );
  };

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
        <div className="space-y-4" data-section="integrations" tabIndex={-1}>
          {fields.map((row, index) => {
            const rowError = (
              formState.errors.integrations as
                | Array<{ difficulty?: { message?: string } }>
                | undefined
            )?.[index]?.difficulty?.message;

            return (
              <div key={row.id} className="space-y-2 rounded-md border p-4">
                <div className="flex items-center justify-between gap-4">
                  <Label>Integration {index + 1}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleRemove(index)}
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
                {showError && rowError ? (
                  <FieldError message={rowError} />
                ) : null}
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={handleAppend}
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
