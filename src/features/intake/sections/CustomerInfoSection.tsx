import { Controller, useFormContext } from "react-hook-form";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";
import { FieldError } from "./FieldError";
import { RequiredLabel } from "./RequiredLabel";
import {
  DEAL_PRIORITIES,
  DEAL_TEMPLATES,
  OPPORTUNITY_STAGES,
} from "./quote-metadata-options";

const CUSTOMER_TYPES: Array<{ value: string; label: string }> = [
  { value: "state_naspo", label: "State (NASPO cooperative)" },
  { value: "state_non_naspo", label: "State (non-NASPO)" },
  { value: "federal", label: "Federal Agency" },
  { value: "county", label: "County / Municipal" },
  { value: "tribal", label: "Tribal Government" },
  { value: "commercial", label: "Commercial" },
];


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
        <Label>Opportunity stage</Label>
        <Controller
          control={control}
          name="opportunityStage"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger aria-label="Opportunity stage">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_STAGES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          For reporting only — does not affect pricing.
        </p>
        <FieldError message={formState.errors.opportunityStage?.message} />
      </div>

      <div className="space-y-2">
        <Label>Deal priority</Label>
        <Controller
          control={control}
          name="dealPriority"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger aria-label="Deal priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {DEAL_PRIORITIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={formState.errors.dealPriority?.message} />
      </div>

      <div className="space-y-2">
        <Label>Deal template used</Label>
        <Controller
          control={control}
          name="dealTemplate"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger aria-label="Deal template used">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {DEAL_TEMPLATES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError message={formState.errors.dealTemplate?.message} />
      </div>

      <div className="space-y-2">
        <Label>Quote validity date</Label>
        <Controller
          control={control}
          name="quoteValidityDate"
          render={({ field }) => {
            const value = field.value ?? null;
            return (
              <div className="space-y-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      className={cn(
                        "w-full justify-start gap-2 font-normal",
                        !value && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="size-4" />
                      {value
                        ? format(parseISO(value), "PPP")
                        : "Pick a validity date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      className="pointer-events-auto p-3"
                      captionLayout="dropdown"
                      startMonth={new Date(new Date().getFullYear(), 0)}
                      endMonth={new Date(new Date().getFullYear() + 5, 11)}
                      defaultMonth={value ? parseISO(value) : new Date()}
                      selected={value ? parseISO(value) : undefined}
                      onSelect={(date) =>
                        field.onChange(date ? format(date, "yyyy-MM-dd") : null)
                      }
                    />
                  </PopoverContent>
                </Popover>
                {value ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => field.onChange(null)}
                  >
                    Clear validity date
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Blank means customer PDFs make no validity statement.
                  </p>
                )}
              </div>
            );
          }}
        />
        <FieldError message={formState.errors.quoteValidityDate?.message} />
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
                onValueChange={(vals: number[]) => field.onChange(vals[0])}
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
