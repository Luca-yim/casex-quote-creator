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

/** Selectable legacy record volume bands. */
export const MIGRATION_VOLUME_OPTIONS = [
  { value: "<100k", label: "Under 100,000 records" },
  { value: "100k-1m", label: "100,000 – 1,000,000" },
  { value: "1m-5m", label: "1 – 5 million" },
  { value: "5m+", label: "5 million+" },
] as const;

/** Section 12 — legacy data migration scope. */
export function MigrationSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";
  const migrationRequired = useWatch({ control, name: "migrationRequired" });

  return (
    <SectionCard icon="📦" title="Data Migration">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="migration-required">
          Migrate data from a legacy system
        </Label>
        <Controller
          control={control}
          name="migrationRequired"
          render={({ field }) => (
            <Switch
              id="migration-required"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      </div>

      {migrationRequired ? (
        <>
          <div className="space-y-2">
            <Label>How many records?</Label>
            <Controller
              control={control}
              name="migrationVolumeRange"
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={disabled}
                >
                  <SelectTrigger aria-label="Migration record volume">
                    <SelectValue placeholder="Select a record volume" />
                  </SelectTrigger>
                  <SelectContent>
                    {MIGRATION_VOLUME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="migration-cleanup">
              Will data need cleanup/deduplication before migration?
            </Label>
            <Controller
              control={control}
              name="migrationCleanupRequired"
              render={({ field }) => (
                <Switch
                  id="migration-cleanup"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              )}
            />
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}
