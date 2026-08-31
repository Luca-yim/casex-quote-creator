import { useMemo, useState, type ReactNode } from "react";
import { useForm, Controller, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import {
  B2B_USER_RANGES,
  COMPLIANCE_OPTIONS,
  EXTERNAL_LOGIN_RANGES,
  HOSTING_PREFERENCES,
  INTEGRATION_COUNT_RANGES,
  INTEGRATION_DIFFICULTY,
  INTERNAL_USER_RANGES,
  REGION_OPTIONS,
} from "./lead-intake-options";

/**
 * Only the three NOT NULL columns on `lead_intakes` are required. Everything
 * else is optional so a prospect can submit a partial enquiry.
 */
export const leadIntakeSchema = z.object({
  organization_name: z.string().trim().min(1, "Organization name is required").max(200),
  contact_name: z.string().trim().min(1, "Your name is required").max(120),
  contact_email: z.string().trim().min(1, "Email is required").email("Enter a valid email").max(255),
  contact_phone: z.string().trim().max(40),
  region: z.string(),
  vertical: z.string(),
  solution: z.string(),
  internal_user_range: z.string(),
  external_portal_required: z.boolean(),
  external_portal_monthly_logins_range: z.string(),
  b2b_portal_required: z.boolean(),
  b2b_user_count_range: z.string(),
  hosting_preference: z.string(),
  compliance_requirements: z.array(z.string()),
  integration_required: z.boolean(),
  integration_count_range: z.string(),
  integration_difficulty: z.string(),
  additional_notes: z.string().trim().max(2000),
});

export type LeadIntakeValues = z.infer<typeof leadIntakeSchema>;

const STEPS = [
  { id: "contact", title: "Contact & organization", blurb: "Who should we get back to?" },
  { id: "solution", title: "Vertical & solution", blurb: "What area are you looking at?" },
  { id: "scope", title: "Scope", blurb: "Roughly how big is the deployment?" },
  { id: "compliance", title: "Compliance", blurb: "Any regimes we must meet?" },
  { id: "integrations", title: "Integrations", blurb: "Systems we would connect to." },
  { id: "notes", title: "Anything else", blurb: "Optional context for our team." },
] as const;

/** Fields validated before leaving each step (only step 1 has requirements). */
const STEP_FIELDS: Array<Array<keyof LeadIntakeValues>> = [
  ["organization_name", "contact_name", "contact_email", "contact_phone"],
  [],
  [],
  [],
  [],
  [],
];

type OptionList = ReadonlyArray<{ value: string; label: string }>;

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: OptionList;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select {...(value ? { value } : {})} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export interface LeadIntakeFormProps {
  /** Persists the lead. Resolves when the insert completed. */
  onSubmit: (values: LeadIntakeValues) => Promise<void>;
  /** Disables the submit button while the anonymous session is still resolving. */
  disabled?: boolean;
  /**
   * Rendered at the bottom of the first step only — used for the CAPTCHA
   * challenge that gates the anonymous session.
   */
  firstStepSlot?: ReactNode;
}

/** Mobile-first, one-group-per-screen public lead intake form. */
export function LeadIntakeForm({ onSubmit, disabled = false, firstStepSlot }: LeadIntakeFormProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { data: verticalSolutions } = useVerticalSolutions();

  const form = useForm<LeadIntakeValues>({
    resolver: zodResolver(leadIntakeSchema),
    mode: "onSubmit",
    defaultValues: {
      organization_name: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      region: "",
      vertical: "",
      solution: "",
      internal_user_range: "",
      external_portal_required: false,
      external_portal_monthly_logins_range: "",
      b2b_portal_required: false,
      b2b_user_count_range: "",
      hosting_preference: "",
      compliance_requirements: [],
      integration_required: false,
      integration_count_range: "",
      integration_difficulty: "",
      additional_notes: "",
    },
  });

  const verticals = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of verticalSolutions ?? []) {
      if (!seen.has(row.vertical_l1)) seen.set(row.vertical_l1, row.vertical_l1);
    }
    return [...seen.keys()].map((value) => ({ value, label: value }));
  }, [verticalSolutions]);

  const selectedVertical = form.watch("vertical");
  const solutions = useMemo(
    () =>
      (verticalSolutions ?? [])
        .filter((row) => !selectedVertical || row.vertical_l1 === selectedVertical)
        .map((row) => ({ value: row.solution_l2, label: row.display_label })),
    [verticalSolutions, selectedVertical],
  );

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step]!;

  const goNext = async () => {
    const fields = STEP_FIELDS[step] ?? [];
    const valid = fields.length === 0 ? true : await form.trigger(fields);
    if (!valid) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit: SubmitHandler<LeadIntakeValues> = async (values) => {
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = form.handleSubmit(submit, () => {
    // Required fields all live on step 1 — send the user back to fix them.
    setStep(0);
  });

  const errors = form.formState.errors;

  return (
    <form
      onSubmit={handleFormSubmit}
      noValidate
      className="mx-auto flex w-full max-w-xl flex-col gap-6"
    >
      <div className="space-y-2" aria-live="polite">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{current.title}</span>
        </div>
        <Progress
          value={((step + 1) / STEPS.length) * 100}
          aria-label={`Step ${step + 1} of ${STEPS.length}`}
        />
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">{current.title}</h2>
        <p className="text-sm text-muted-foreground">{current.blurb}</p>
      </div>

      <div className="space-y-4">
        {step === 0 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="organization_name">
                Organization name <span aria-hidden="true">*</span>
              </Label>
              <Input id="organization_name" {...form.register("organization_name")} />
              <p className="text-xs text-destructive">{errors.organization_name?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">
                Your name <span aria-hidden="true">*</span>
              </Label>
              <Input id="contact_name" {...form.register("contact_name")} />
              <p className="text-xs text-destructive">{errors.contact_name?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">
                Work email <span aria-hidden="true">*</span>
              </Label>
              <Input id="contact_email" type="email" {...form.register("contact_email")} />
              <p className="text-xs text-destructive">{errors.contact_email?.message}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Phone (optional)</Label>
              <Input id="contact_phone" type="tel" {...form.register("contact_phone")} />
            </div>
            <Controller
              control={form.control}
              name="region"
              render={({ field }) => (
                <SelectField
                  id="region"
                  label="Region"
                  value={field.value}
                  onChange={field.onChange}
                  options={REGION_OPTIONS}
                  placeholder="Select a region"
                />
              )}
            />
            {firstStepSlot}
          </>
        )}

        {step === 1 && (
          <>
            <Controller
              control={form.control}
              name="vertical"
              render={({ field }) => (
                <SelectField
                  id="vertical"
                  label="Vertical"
                  value={field.value}
                  onChange={(next) => {
                    field.onChange(next);
                    form.setValue("solution", "");
                  }}
                  options={verticals}
                  placeholder="Select a vertical"
                />
              )}
            />
            {selectedVertical === OTHER_VERTICAL ? (
              <div className="space-y-2">
                <Label htmlFor="vertical_other_detail">
                  Please describe your area of need <span aria-hidden="true">*</span>
                </Label>
                <Input
                  id="vertical_other_detail"
                  {...form.register("vertical_other_detail")}
                />
                <p className="text-xs text-destructive">
                  {errors.vertical_other_detail?.message}
                </p>
              </div>
            ) : (
              <Controller
                control={form.control}
                name="solution"
                render={({ field }) => (
                  <SelectField
                    id="solution"
                    label="Solution"
                    value={field.value}
                    onChange={field.onChange}
                    options={solutions}
                    placeholder={
                      !selectedVertical
                        ? "Select a vertical first"
                        : solutions.length === 0
                          ? "Loading solutions…"
                          : "Select a solution"
                    }
                  />
                )}
              />
            )}

          </>
        )}

        {step === 2 && (
          <>
            <Controller
              control={form.control}
              name="internal_user_range"
              render={({ field }) => (
                <SelectField
                  id="internal_user_range"
                  label="Internal users"
                  value={field.value}
                  onChange={field.onChange}
                  options={INTERNAL_USER_RANGES}
                  placeholder="Select a range"
                />
              )}
            />
            <Controller
              control={form.control}
              name="external_portal_required"
              render={({ field }) => (
                <ToggleRow
                  id="external_portal_required"
                  label="Public-facing portal needed"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {form.watch("external_portal_required") && (
              <Controller
                control={form.control}
                name="external_portal_monthly_logins_range"
                render={({ field }) => (
                  <SelectField
                    id="external_portal_monthly_logins_range"
                    label="Monthly portal logins"
                    value={field.value}
                    onChange={field.onChange}
                    options={EXTERNAL_LOGIN_RANGES}
                    placeholder="Select a range"
                  />
                )}
              />
            )}
            <Controller
              control={form.control}
              name="b2b_portal_required"
              render={({ field }) => (
                <ToggleRow
                  id="b2b_portal_required"
                  label="Partner / B2B portal needed"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {form.watch("b2b_portal_required") && (
              <Controller
                control={form.control}
                name="b2b_user_count_range"
                render={({ field }) => (
                  <SelectField
                    id="b2b_user_count_range"
                    label="Partner users"
                    value={field.value}
                    onChange={field.onChange}
                    options={B2B_USER_RANGES}
                    placeholder="Select a range"
                  />
                )}
              />
            )}
            <Controller
              control={form.control}
              name="hosting_preference"
              render={({ field }) => (
                <SelectField
                  id="hosting_preference"
                  label="Hosting preference"
                  value={field.value}
                  onChange={field.onChange}
                  options={HOSTING_PREFERENCES}
                  placeholder="Select a preference"
                />
              )}
            />
          </>
        )}

        {step === 3 && (
          <Controller
            control={form.control}
            name="compliance_requirements"
            render={({ field }) => {
              const selected = field.value ?? [];
              return (
                <div className="grid grid-cols-2 gap-3">
                  {COMPLIANCE_OPTIONS.map((option) => {
                    const active = selected.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          field.onChange(
                            active
                              ? selected.filter((v) => v !== option.value)
                              : [...selected, option.value],
                          )
                        }
                        className={cn(
                          "rounded-lg border p-3 text-left text-sm transition-colors",
                          active
                            ? "border-brand bg-brand/10 font-medium text-brand"
                            : "hover:bg-muted",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              );
            }}
          />
        )}

        {step === 4 && (
          <>
            <Controller
              control={form.control}
              name="integration_required"
              render={({ field }) => (
                <ToggleRow
                  id="integration_required"
                  label="Integrations with other systems"
                  checked={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {form.watch("integration_required") && (
              <>
                <Controller
                  control={form.control}
                  name="integration_count_range"
                  render={({ field }) => (
                    <SelectField
                      id="integration_count_range"
                      label="How many integrations"
                      value={field.value}
                      onChange={field.onChange}
                      options={INTEGRATION_COUNT_RANGES}
                      placeholder="Select a range"
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name="integration_difficulty"
                  render={({ field }) => (
                    <SelectField
                      id="integration_difficulty"
                      label="Expected difficulty"
                      value={field.value}
                      onChange={field.onChange}
                      options={INTEGRATION_DIFFICULTY}
                      placeholder="Select difficulty"
                    />
                  )}
                />
              </>
            )}
          </>
        )}

        {step === 5 && (
          <div className="space-y-2">
            <Label htmlFor="additional_notes">Anything else we should know? (optional)</Label>
            <Textarea id="additional_notes" rows={6} {...form.register("additional_notes")} />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex-1"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back
          </Button>
        )}
        {isLast ? (
          <Button key="submit" type="submit" className="flex-1" disabled={submitting || disabled}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Sending…
              </>
            ) : (
              "Submit request"
            )}
          </Button>
        ) : (
          // Distinct keys keep React from reusing the same DOM node when the
          // "Continue" button becomes the submit button, which would otherwise let
          // the click that reveals the last step also submit the form.
          <Button key="next" type="button" onClick={goNext} className="flex-1">
            Continue <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </form>
  );
}
