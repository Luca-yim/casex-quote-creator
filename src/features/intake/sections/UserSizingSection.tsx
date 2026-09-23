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

/**
 * Section 4 — Proposal-only user sizing (Q4.2, Q4.3, Q4.6, Q4.8, Q4.9).
 * Persist-only: no pricing, WBS, driver, assumption or PDF effect.
 * Suggested values are helper text only — every field starts blank and stays
 * NULL until the user enters a value. Write authorization is enforced by the
 * `quotes_enforce_section4_sizing_authorization` DB trigger.
 */
export function UserSizingSection() {
  const { quote, role, mode } = useIntake();
  const { control, register, formState, setValue } =
    useFormContext<QuoteFormData>();
  const growth = useWatch({ control, name: "expectedUserGrowth" });
  const peak = useWatch({ control, name: "peakLoadMultiplier" });
  const includeB2b = useWatch({ control, name: "includeB2bPortal" });
  const caseWorkers = useWatch({ control, name: "caseWorkerCount" });

  // Ballpark isolation (+ external isolation, matching Q3.4).
  if (quote.tier !== "proposal" || role === "external") return null;

  const disabled = mode === "readonly";
  const suggestedStudio =
    typeof caseWorkers === "number" && caseWorkers > 0
      ? Math.ceil(caseWorkers / 25)
      : null;

  const numberInput = (
    name: "caseWorkerStudioUsers" | "b2bOrgCount" | "b2bAvgUsersPerOrg",
    id: string,
    max?: number,
    placeholder?: string,
  ) => (
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
          placeholder={placeholder}
          value={field.value ?? ""}
          onChange={(event) =>
            field.onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        />
      )}
    />
  );

  return (
    <SectionCard icon="📈" title="User Sizing">
      <div className="space-y-2">
        <Label htmlFor="case-worker-studio-users">Case Worker Studio Users</Label>
        {numberInput("caseWorkerStudioUsers", "case-worker-studio-users", 50)}
        <p className="text-xs text-muted-foreground">
          Typical: 1 studio user per 25 case workers
          {suggestedStudio !== null ? ` (suggested: ${suggestedStudio})` : ""}.
          Maximum 50.
        </p>
        <FieldError message={formState.errors.caseWorkerStudioUsers?.message} />
      </div>

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
                if (value !== "other") {
                  setValue("expectedUserGrowthOtherDetail", null, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }
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
          Typical: Moderate. Does not add users to the quote.
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
          <FieldError
            message={formState.errors.expectedUserGrowthOtherDetail?.message}
          />
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
                if (value !== "other") {
                  setValue("peakLoadMultiplierOtherDetail", null, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }
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
        <p className="text-xs text-muted-foreground">Typical: Steady.</p>
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
          <FieldError
            message={formState.errors.peakLoadMultiplierOtherDetail?.message}
          />
        </div>
      ) : null}

      {includeB2b === true ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="b2b-org-count">Number of B2B Organizations</Label>
            {numberInput("b2bOrgCount", "b2b-org-count")}
            <p className="text-xs text-muted-foreground">Typical: 100.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="b2b-avg-users-per-org">
              Average Users per B2B Organization
            </Label>
            {numberInput("b2bAvgUsersPerOrg", "b2b-avg-users-per-org")}
            <p className="text-xs text-muted-foreground">Typical: 3.</p>
          </div>
        </>
      ) : null}
    </SectionCard>
  );
}
