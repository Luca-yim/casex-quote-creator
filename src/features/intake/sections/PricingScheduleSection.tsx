import { useEffect } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
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
import { FieldError } from "./FieldError";
import {
  PRICING_SCHEDULES,
  pricingScheduleDefaultFor,
} from "./quote-metadata-options";

/**
 * Q2.3 — Pricing Schedule. Estimator/Admin-only, Proposal-only. Declares the
 * commercial price basis for this Proposal. Metadata only in this slice:
 * selecting any value — including custom or other — does not alter any
 * pricing calculation, and the price-book freeze remains a separate
 * workstream. The detail field is never shown to sales reps or external
 * users.
 */
export function PricingScheduleSection() {
  const { quote, role, mode, updateField } = useIntake();
  const { control, register, formState } = useFormContext<QuoteFormData>();
  const schedule = useWatch({ control, name: "pricingSchedule" });

  const canEdit = role === "estimator" || role === "admin";
  const disabled = mode === "readonly" || !canEdit;

  // Materialize the application UI default (naspo for NASPO customers, list
  // otherwise) on mount so the stored value is always explicit once a
  // Proposal has been worked. There is deliberately no database default.
  // Mount-only sync; Ballpark quotes never receive a value.
  useEffect(() => {
    if (mode !== "edit" || !canEdit || quote.tier !== "proposal") return;
    if (quote.pricingSchedule == null) {
      updateField("pricingSchedule", pricingScheduleDefaultFor(quote.customerType));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ballpark isolation: this control exists only in the protected
  // estimator/admin Proposal surface.
  if (quote.tier !== "proposal" || !canEdit) return null;

  return (
    <SectionCard icon="💵" title="Pricing Schedule">
      <div className="space-y-2">
        <Label>Pricing schedule</Label>
        <Controller
          control={control}
          name="pricingSchedule"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger aria-label="Pricing schedule">
                <SelectValue placeholder="Select pricing schedule" />
              </SelectTrigger>
              <SelectContent>
                {PRICING_SCHEDULES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Declares the price basis for this Proposal. Required before the
          Proposal is submitted or approved; changing it does not recalculate
          pricing.
        </p>
        <FieldError message={formState.errors.pricingSchedule?.message} />
      </div>

      {schedule === "other" ? (
        <div className="space-y-2">
          <Label htmlFor="pricing-schedule-other-detail">
            Describe the pricing schedule
          </Label>
          <Input
            id="pricing-schedule-other-detail"
            disabled={disabled}
            placeholder="e.g., Negotiated cooperative addendum"
            {...register("pricingScheduleOtherDetail")}
          />
          <FieldError message={formState.errors.pricingScheduleOtherDetail?.message} />
        </div>
      ) : null}
    </SectionCard>
  );
}
