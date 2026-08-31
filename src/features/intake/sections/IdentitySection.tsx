import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";

/** Section 13 — identity / single sign-on topology. */
export function IdentitySection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";
  const externalIdp = useWatch({ control, name: "externalIdpRequired" });
  const workerIdp = useWatch({ control, name: "workerIdpRequired" });
  const anyIdp = Boolean(externalIdp) || Boolean(workerIdp);

  return (
    <SectionCard icon="🔐" title="Identity & SSO">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="external-idp">
          Do external portal users need SSO?
        </Label>
        <Controller
          control={control}
          name="externalIdpRequired"
          render={({ field }) => (
            <Switch
              id="external-idp"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="worker-idp">Do internal staff need SSO?</Label>
        <Controller
          control={control}
          name="workerIdpRequired"
          render={({ field }) => (
            <Switch
              id="worker-idp"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </div>

      {anyIdp ? (
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="idp-documented">
            Are the integration details already documented?
          </Label>
          <Controller
            control={control}
            name="idpDocumented"
            render={({ field }) => (
              <Switch
                id="idp-documented"
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
