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
import { BILLING_PREFERENCES } from "./quote-metadata-options";

/**
 * Q3.4 — Billing Preference. Proposal-only and optional: it never gates
 * completion, submission or approval, and it feeds no pricing, WBS, NASPO,
 * margin, contingency or scoring calculation.
 *
 * Visible to sales reps, estimators and admins; never rendered for external
 * users, never rendered on Ballpark quotes, and absent from public lead
 * intake. Server-side enforcement lives in `quotes_scoped()` masking and the
 * `quotes_enforce_billing_preference_authorization` trigger — this render
 * gate is a convenience, not the security boundary.
 */
export function BillingPreferenceSection() {
  const { quote, role, mode } = useIntake();
  const { control, register, formState, setValue } =
    useFormContext<QuoteFormData>();
  const preference = useWatch({ control, name: "billingPreference" });

  // Ballpark isolation + external isolation.
  if (quote.tier !== "proposal" || role === "external") return null;

  const disabled = mode === "readonly";

  return (
    <SectionCard icon="🧾" title="Billing Preference">
      <div className="space-y-2">
        <Label>Billing preference</Label>
        <Controller
          control={control}
          name="billingPreference"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value);
                // Changing away from "Other" clears the stale detail text.
                if (value !== "other") {
                  setValue("billingPreferenceOtherDetail", null, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }
              }}
              disabled={disabled}
            >
              <SelectTrigger aria-label="Billing preference">
                <SelectValue placeholder="Select billing preference" />
              </SelectTrigger>
              <SelectContent>
                {BILLING_PREFERENCES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Optional. How the customer prefers to be invoiced; this does not
          change any pricing.
        </p>
        <FieldError message={formState.errors.billingPreference?.message} />
      </div>

      {preference === "other" ? (
        <div className="space-y-2">
          <Label htmlFor="billing-preference-other-detail">
            Describe the billing preference
          </Label>
          <Input
            id="billing-preference-other-detail"
            disabled={disabled}
            placeholder="e.g., Milestone-based invoicing"
            {...register("billingPreferenceOtherDetail")}
          />
          <FieldError
            message={formState.errors.billingPreferenceOtherDetail?.message}
          />
        </div>
      ) : null}
    </SectionCard>
  );
}
