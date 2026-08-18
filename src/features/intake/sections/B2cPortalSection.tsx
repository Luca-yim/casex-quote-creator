import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";

/** Midpoint MAU values stored for each selectable band. */
const MAU_OPTIONS = [
  { value: 500, label: "Up to 1,000 MAU" },
  { value: 5000, label: "1,001 – 10,000 MAU" },
  { value: 25000, label: "10,001 – 50,000 MAU" },
  { value: 75000, label: "50,001 – 100,000 MAU" },
  { value: 150000, label: "100,001 – 200,000 MAU" },
];

/** Section 8 — optional B2C citizen portal and its MAU band. */
export function B2cPortalSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";
  const includeB2c = useWatch({ control, name: "includeB2c" });

  return (
    <SectionCard icon="🌐" title="B2C Portal">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="include-b2c">Include a public citizen portal</Label>
        <Controller
          control={control}
          name="includeB2c"
          render={({ field }) => (
            <Switch
              id="include-b2c"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </div>

      {includeB2c ? (
        <div className="space-y-2">
          <Label>Monthly active users</Label>
          <Controller
            control={control}
            name="b2cMau"
            render={({ field }) => (
              <Select
                value={field.value != null ? String(field.value) : ""}
                onValueChange={(value) => field.onChange(Number(value))}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select expected MAU" />
                </SelectTrigger>
                <SelectContent>
                  {MAU_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
