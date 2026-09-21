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
import { GEOGRAPHIC_SCOPES } from "./quote-metadata-options";

/**
 * Q2.2 — Geographic Scope. Proposal-only: never rendered for Ballpark
 * quotes, never part of public intake, and never mapped from the public
 * lead's world-geography `region` field (the two are not semantically
 * equivalent). Answered separately on the Proposal, unanswered by default.
 */
export function GeographicScopeSection() {
  const { quote, mode } = useIntake();
  const { control, register, formState } = useFormContext<QuoteFormData>();
  const scope = useWatch({ control, name: "geographicScope" });

  // Ballpark isolation: this control exists only in the Proposal experience.
  if (quote.tier !== "proposal") return null;

  const disabled = mode === "readonly";

  return (
    <SectionCard icon="🗺️" title="Geographic Scope">
      <div className="space-y-2">
        <Label>Geographic scope</Label>
        <Controller
          control={control}
          name="geographicScope"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger aria-label="Geographic scope">
                <SelectValue placeholder="Select geographic scope" />
              </SelectTrigger>
              <SelectContent>
                {GEOGRAPHIC_SCOPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          How broad is this engagement? Leave blank if not yet known.
        </p>
        <FieldError message={formState.errors.geographicScope?.message} />
      </div>

      {scope === "other" ? (
        <div className="space-y-2">
          <Label htmlFor="geographic-scope-other-detail">
            Describe the geographic scope
          </Label>
          <Input
            id="geographic-scope-other-detail"
            disabled={disabled}
            placeholder="e.g., Multi-county consortium"
            {...register("geographicScopeOtherDetail")}
          />
          <FieldError message={formState.errors.geographicScopeOtherDetail?.message} />
        </div>
      ) : null}
    </SectionCard>
  );
}
