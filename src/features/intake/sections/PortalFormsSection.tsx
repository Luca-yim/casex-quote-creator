import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Label } from "@/components/ui/label";
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

/** Selectable portal form-count bands. */
export const PORTAL_FORM_COUNT_OPTIONS = [
  { value: "1-3", label: "1-3" },
  { value: "4-10", label: "4-10" },
  { value: "11-25", label: "11-25" },
  { value: "26+", label: "26+" },
] as const;

/** Section 10 — number of forms across the selected portals. */
export function PortalFormsSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";
  const includeB2c = useWatch({ control, name: "includeB2c" });
  const includeB2b = useWatch({ control, name: "includeB2bPortal" });

  if (!includeB2c && !includeB2b) return null;

  return (
    <SectionCard icon="📝" title="Portal Forms">
      <div className="space-y-2">
        <Label>How many forms will the portals include?</Label>
        <Controller
          control={control}
          name="portalFormCountRange"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger aria-label="Portal form count">
                <SelectValue placeholder="Select a form count" />
              </SelectTrigger>
              <SelectContent>
                {PORTAL_FORM_COUNT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </SectionCard>
  );
}
