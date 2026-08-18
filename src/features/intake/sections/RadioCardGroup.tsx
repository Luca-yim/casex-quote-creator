import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** Selectable card-style radio group used across intake sections. */
export function RadioCardGroup({
  name,
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  name: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  options: RadioCardOption[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <RadioGroup
      value={value ?? undefined}
      onValueChange={onChange}
      disabled={disabled}
      className={cn("grid gap-3", className)}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const selected = value === option.value;
        return (
          <Label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
              selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              (disabled || option.disabled) &&
                "cursor-not-allowed opacity-60 hover:bg-transparent",
            )}
          >
            <RadioGroupItem
              id={id}
              value={option.value}
              disabled={disabled || option.disabled}
              className="mt-1"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">{option.label}</span>
              {option.description ? (
                <span className="block text-sm text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
