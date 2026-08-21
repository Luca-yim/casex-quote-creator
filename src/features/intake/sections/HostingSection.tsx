import { useEffect } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Compliance, QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { AmberNote, SectionCard } from "./SectionCard";
import { FieldError } from "./FieldError";
import { RadioCardGroup } from "./RadioCardGroup";
import { FEDRAMP_FORCING } from "./ComplianceSection";

/** Section 10 — hosting model and environment count, gated by compliance. */
export function HostingSection() {
  const { control, formState, setValue } = useFormContext<QuoteFormData>();
  const { mode, updateField } = useIntake();
  const disabled = mode === "readonly";

  const compliance = (useWatch({ control, name: "compliance" }) ??
    []) as Compliance[];
  const hostingModel = useWatch({ control, name: "hostingModel" });
  const fedrampRequired = compliance.some((item) =>
    FEDRAMP_FORCING.includes(item),
  );

  // Auto-set values must persist exactly like user-set ones, so the quote is
  // updated alongside the form (react-hook-form's watch subscription only
  // reports user "change" events, not programmatic setValue).
  //
  // Design decision: when a FedRAMP-forcing compliance regime is later
  // removed, hosting STAYS on "fedramp" (Option B). It is a valid selection,
  // resetting it would silently un-complete a required field and lose the
  // user's context; the field simply becomes editable again.
  useEffect(() => {
    if (disabled) return;
    if (fedrampRequired && hostingModel !== "fedramp") {
      setValue("hostingModel", "fedramp", { shouldDirty: true });
      updateField("hostingModel", "fedramp");
    }
  }, [fedrampRequired, hostingModel, setValue, updateField, disabled]);

  const options = [
    {
      value: "soc2",
      label: "SOC-2 Hosting",
      disabled: fedrampRequired,
    },
    { value: "fedramp", label: "FedRAMP Hosting" },
    {
      value: "customer_hosted",
      label: "Customer-Hosted (no monthly fee)",
      disabled: fedrampRequired,
    },
  ];

  return (
    <SectionCard icon="☁️" title="Hosting" required>
      <Controller
        control={control}
        name="hostingModel"
        render={({ field }) => (
          <RadioCardGroup
            name="hosting-model"
            value={field.value}
            onChange={field.onChange}
            options={options}
            disabled={disabled}
          />
        )}
      />
      <FieldError message={formState.errors.hostingModel?.message} />

      {fedrampRequired ? (
        <AmberNote>FedRAMP required by your compliance selections.</AmberNote>
      ) : null}

      {hostingModel !== "customer_hosted" ? (
        <div className="space-y-2">
          <Label htmlFor="environment-count">
            How many environments (dev, staging, prod)?
          </Label>
          <Controller
            control={control}
            name="environmentCount"
            render={({ field }) => (
              <Input
                id="environment-count"
                type="number"
                min={1}
                disabled={disabled}
                value={field.value ?? 3}
                onChange={(event) =>
                  field.onChange(
                    event.target.value === "" ? 3 : Number(event.target.value),
                  )
                }
              />
            )}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
