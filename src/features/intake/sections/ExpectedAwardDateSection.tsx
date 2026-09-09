import { Controller, useFormContext } from "react-hook-form";
import { format, parseISO, startOfToday } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";

/** Section 2 — optional expected award date. Does not affect pricing. */
export function ExpectedAwardDateSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";

  return (
    <SectionCard icon="📅" title="Expected Award Date">
      <Controller
        control={control}
        name="expectedAwardDate"
        render={({ field }) => {
          const value = field.value ?? null;
          return (
            <div className="space-y-3">
              <Label>Expected award date (optional)</Label>
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
                      : "Pick an expected award date"}
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
                    disabled={(date) => date < startOfToday()}
                    selected={value ? parseISO(value) : undefined}
                    onSelect={(date) =>
                      field.onChange(date ? format(date, "yyyy-MM-dd") : null)
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          );
        }}
      />
    </SectionCard>
  );
}
