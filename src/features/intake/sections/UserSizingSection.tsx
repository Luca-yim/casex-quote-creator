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

export const EXPECTED_USER_GROWTH_OPTIONS = [
  { value: "flat", label: "Flat" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "rapid", label: "Rapid" },
  { value: "other", label: "Other" },
] as const;

export const PEAK_LOAD_PROFILE_OPTIONS = [
  { value: "steady", label: "Steady" },
  { value: "seasonal", label: "Seasonal" },
  { value: "high_burst", label: "High burst" },
  { value: "other", label: "Other" },
] as const;

type NumericField = "caseWorkerStudioUsers" | "b2bOrgCount" | "b2bAvgUsersPerOrg";
type DetailField = "expectedUserGrowthOtherDetail" | "peakLoadMultiplierOtherDetail";

/**
 * Section 4 — Proposal-only, persist-only user sizing (Q4.2, Q4.3, Q4.6,
 * Q4.8, Q4.9). None of these fields feed pricing, WBS, drivers, assumptions
 * or any output. Suggested values are helper text only — every field starts
 * blank and stays NULL until the user enters a value.
 *
 * Write authorization is enforced server-side by
 * `quotes_enforce_section4_sizing_authorization`; this gate only decides
 * where the controls are offered.
 */
export function UserSizingSection() {
  const { quote, role, mode, updateField } = useIntake();
  const { control, register, formState, setValue } =
    useFormContext<QuoteFormData>();
  const growth = useWatch({ control, name: "expectedUserGrowth" });
  const peak = useWatch({ control, name: "peakLoadMultiplier" });
  const includeB2bPortal = useWatch({ control, name: "includeB2bPortal" });
  const caseWorkerCount = useWatch({ control, name: "caseWorkerCount" });

  // Ballpark isolation (IntakeForm mounts every section unconditionally).
  if (quote.tier !== "proposal") return null;
  // Proposal-only internal fields never render for external users.
  if (role === "external") return null;

  const disabled = mode === "readonly";
  const suggestedStudio =
    typeof caseWorkerCount === "number" && caseWorkerCount > 0
      ? Math.ceil(caseWorkerCount / 25)
      : null;

  const clearDetail = (field: DetailField) => {
    setValue(field, null, { shouldDirty: true, shouldTouch: true });
    // setValue does not emit a "change" watch event, so persist explicitly;
    // it joins the parent's pending debounced patch (one request).
    updateField(field, null);
  };

  const numberInput = (name: NumericField, id: string, label: string, helper: string, max?: number) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={id}
            type="number"
            min={0}
            max={max}
            step={1}
            disabled={disabled}
            value={field.value ?? ""}
            onChange={(event) =>
              field.onChange(
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        )}
      />
      <p className="text-xs text-muted-foreground">{helper}</p>
      <FieldError message={formState.errors[name]?.message} />
    </div>
  );

  return (
    <SectionCard icon="📈" title="User Sizing">
      {numberInput(
        "caseWorkerStudioUsers",
        "case-worker-studio-users",
        "Case Worker Studio Users",
        `Optional, 0–50. Typical: 1 studio user per 25 case workers${
          suggestedStudio !== null ? ` (suggested: ${suggestedStudio})` : ""
        }.`,
        50,
      )}

      <div className="space-y-2">
        <Label>Expected User Growth</Label>
        <Controller
          control={control}
          name="expectedUserGrowth"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value);
                if (value !== "other") clearDetail("expectedUserGrowthOtherDetail");
              }}
              disabled={disabled}
            >
              <SelectTrigger aria-label="Expected User Growth">
                <SelectValue placeholder="Select expected growth" />
              </SelectTrigger>
              <SelectContent>
                {EXPECTED_USER_GROWTH_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Optional. Typical: Moderate. Does not add users to the quote.
        </p>
      </div>
      {growth === "other" ? (
        <div className="space-y-2">
          <Label htmlFor="expected-user-growth-other-detail">
            Describe the expected growth pattern
          </Label>
          <Input
            id="expected-user-growth-other-detail"
            disabled={disabled}
            {...register("expectedUserGrowthOtherDetail")}
          />
          <FieldError message={formState.errors.expectedUserGrowthOtherDetail?.message} />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Peak Load Profile</Label>
        <Controller
          control={control}
          name="peakLoadMultiplier"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                field.onChange(value);
                if (value !== "other") clearDetail("peakLoadMultiplierOtherDetail");
              }}
              disabled={disabled}
            >
              <SelectTrigger aria-label="Peak Load Profile">
                <SelectValue placeholder="Select peak load profile" />
              </SelectTrigger>
              <SelectContent>
                {PEAK_LOAD_PROFILE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">Optional. Typical: Steady.</p>
      </div>
      {peak === "other" ? (
        <div className="space-y-2">
          <Label htmlFor="peak-load-multiplier-other-detail">
            Describe the peak load profile
          </Label>
          <Input
            id="peak-load-multiplier-other-detail"
            disabled={disabled}
            {...register("peakLoadMultiplierOtherDetail")}
          />
          <FieldError message={formState.errors.peakLoadMultiplierOtherDetail?.message} />
        </div>
      ) : null}

      {includeB2bPortal === true ? (
        <>
          {numberInput(
            "b2bOrgCount",
            "b2b-org-count",
            "Number of B2B Organizations",
            "Optional. Typical: 100.",
          )}
          {numberInput(
            "b2bAvgUsersPerOrg",
            "b2b-avg-users-per-org",
            "Average Users per B2B Organization",
            "Optional. Typical: 3.",
          )}
        </>
      ) : null}
    </SectionCard>
  );
}
