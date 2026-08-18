import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";

/** Section 9 — optional B2B partner portal and its user count. */
export function B2bPortalSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";
  const includeB2b = useWatch({ control, name: "includeB2bPortal" });

  return (
    <SectionCard icon="💼" title="B2B Portal">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="include-b2b">Include a partner/provider portal</Label>
        <Controller
          control={control}
          name="includeB2bPortal"
          render={({ field }) => (
            <Switch
              id="include-b2b"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </div>

      {includeB2b ? (
        <div className="space-y-2">
          <Label htmlFor="b2b-user-count">Number of B2B users</Label>
          <Controller
            control={control}
            name="b2bUserCount"
            render={({ field }) => (
              <Input
                id="b2b-user-count"
                type="number"
                min={0}
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
        </div>
      ) : null}
    </SectionCard>
  );
}
