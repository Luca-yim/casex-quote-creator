import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { selectCaseWorkerTier } from "@/lib/calculation-engine";
import { formatCurrency } from "@/lib/utils";
import type { QuoteFormData } from "@/types/quote";
import { useIntake } from "../IntakeContext";
import { SectionCard } from "./SectionCard";

/** Section 7 — case worker seat count plus (for pricing roles) the tier chip. */
export function CaseWorkerSection() {
  const { control } = useFormContext<QuoteFormData>();
  const { mode, showPricing } = useIntake();
  const { data: catalog = [] } = usePricingCatalog();

  return (
    <SectionCard icon="👥" title="Case Workers">
      <Controller
        control={control}
        name="caseWorkerCount"
        render={({ field }) => {
          const count = field.value ?? 0;
          const tier = showPricing
            ? selectCaseWorkerTier(count, catalog)
            : null;
          const tierNumber = tier?.sku_id.replace("cw_tier", "");
          return (
            <div className="space-y-2">
              <Label htmlFor="case-worker-count">
                How many case workers will use the system?
              </Label>
              <Input
                id="case-worker-count"
                type="number"
                min={0}
                disabled={mode === "readonly"}
                value={field.value ?? ""}
                onChange={(event) =>
                  field.onChange(
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                  )
                }
              />
              {tier ? (
                <span className="inline-flex rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Tier {tierNumber} pricing applies at{" "}
                  {formatCurrency(tier.unit_price)}/user/mo
                </span>
              ) : null}
            </div>
          );
        }}
      />
    </SectionCard>
  );
}
