import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { RequiredLabel } from "./RequiredLabel";

const CUSTOMER_TYPES: Array<{ value: string; label: string }> = [
  { value: "state_naspo", label: "State (NASPO cooperative)" },
  { value: "state_non_naspo", label: "State (non-NASPO)" },
  { value: "federal", label: "Federal Agency" },
  { value: "county", label: "County / Municipal" },
  { value: "tribal", label: "Tribal Government" },
  { value: "commercial", label: "Commercial" },
];

const CONTRACT_YEARS = [1, 3, 5, 7, 10];

/** Section 1 — quote name, customer identity, type and contract length. */
export function CustomerInfoSection() {
  const { control, register, formState } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";

  return (
    <SectionCard icon="🏢" title="Customer Info">
      <div className="space-y-2">
        <Label htmlFor="quote-name">Quote name</Label>
        <Input
          id="quote-name"
          disabled={disabled}
          placeholder="Untitled Quote"
          {...register("name")}
        />
        <p className="text-xs text-muted-foreground">
          Internal reference only — customers never see this.
        </p>
        <FieldError message={formState.errors.name?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-name">
          <RequiredLabel>Customer organization</RequiredLabel>
        </Label>
        <Input
          id="customer-name"
          aria-required="true"
          disabled={disabled}
          placeholder="e.g., State of Nevada"
          {...register("customerName")}
        />
        <FieldError message={formState.errors.customerName?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer-email">Contact email</Label>
        <Input
          id="customer-email"
          type="email"
          disabled={disabled}
          placeholder="name@agency.gov"
          {...register("customerEmail")}
        />
        <FieldError message={formState.errors.customerEmail?.message} />
      </div>

      <div className="space-y-2">
        <Label>
          <RequiredLabel>Customer type</RequiredLabel>
        </Label>
        <Controller
          control={control}
          name="customerType"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger aria-required="true">
                <SelectValue placeholder="Select customer type" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={formState.errors.customerType?.message} />
      </div>

      <div className="space-y-2">
        <Label>
          <RequiredLabel>Contract term (years)</RequiredLabel>
        </Label>
        <Controller
          control={control}
          name="contractYears"
          render={({ field }) => (
            <div className="space-y-2">
              <Slider
                min={1}
                max={10}
                step={1}
                disabled={disabled}
                value={[field.value ?? 3]}
                onValueChange={([value]) => field.onChange(value)}
              />
              <p className="text-sm font-medium">
                {field.value ?? 3} {(field.value ?? 3) === 1 ? "year" : "years"}
              </p>
            </div>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Multi-year terms often unlock better rates
        </p>
        <FieldError message={formState.errors.contractYears?.message} />
      </div>
    </SectionCard>
  );
}
