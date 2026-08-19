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
import { deriveTimeline } from "@/lib/timeline-helper";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";

const CHIP_STYLES: Record<string, string> = {
  aggressive:
    "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  standard:
    "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  comfortable:
    "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300",
};

/** Section 2 — optional target go-live date with a derived timeline chip. */
export function TargetGoLiveSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode } = useIntake();
  const disabled = mode === "readonly";

  return (
    <SectionCard icon="📅" title="Target Go-Live Date">
      <Controller
        control={control}
        name="targetGoLiveDate"
        render={({ field }) => {
          const value = field.value ?? null;
          const timeline = deriveTimeline(value);
          return (
            <div className="space-y-3">
              <Label>Target go-live (optional)</Label>
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
                      : "Pick a target date"}
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

              {timeline.tier ? (
                <span
                  className={cn(
                    "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                    CHIP_STYLES[timeline.tier],
                  )}
                >
                  {timeline.displayLabel}
                </span>
              ) : null}
            </div>
          );
        }}
      />
    </SectionCard>
  );
}
