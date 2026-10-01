import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/test-utils";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { IntakeProvider, type IntakeContextValue } from "../IntakeContext";
import { mergePendingPatch, normalizeFieldValue } from "../useDebouncedSave";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }));

vi.mock("@/hooks/useVerticalSolutions", () => ({
  useVerticalSolutions: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useVerticalLabels", () => ({
  OTHER_VERTICAL: "other",
  useVerticalLabels: () => ({
    options: [{ value: "HHS" }, { value: "Licensing" }, { value: "other" }],
    isLoading: false,
  }),
}));

import { FormProvider, useForm } from "react-hook-form";
import { VerticalSolutionSection } from "../sections/VerticalSolutionSection";
import type { QuoteFormData } from "@/types/quote";

function Harness({ value }: { value: IntakeContextValue }) {
  const form = useForm<QuoteFormData>({
    defaultValues: { vertical: "HHS", solution: "Eligibility Case Management" } as never,
  });
  return (
    <IntakeProvider value={value}>
      <FormProvider {...form}>
        <VerticalSolutionSection />
      </FormProvider>
    </IntakeProvider>
  );
}

describe("solution is saved as null, never an empty string", () => {
  it.each(["Licensing", "other"])(
    "changing the vertical to %s saves solution = null",
    async (next) => {
      const updateField = vi.fn();
      const quote = makeQuote({ state: "draft" });
      render(
        <Harness
          value={{
            quoteId: quote.id,
            quote,
            role: "sales_rep",
            mode: "edit",
            showPricing: false,
            updateField,
            flushSave: vi.fn(async () => {}),
            isSaving: false,
            lastSavedAt: null,
            hasPendingChanges: false,
            validationErrors: {},
          }}
        />,
      );
      await userEvent.click(screen.getByLabelText(next));
      const solutionCalls = updateField.mock.calls.filter(([f]) => f === "solution");
      expect(solutionCalls.length).toBeGreaterThan(0);
      for (const [, v] of solutionCalls) expect(v).toBeNull();
    },
  );

  it("the save step coerces blank and whitespace-only solution to null", () => {
    expect(mergePendingPatch({}, "solution", "")).toEqual({ solution: null });
    expect(mergePendingPatch({}, "solution", "   ")).toEqual({ solution: null });
    expect(mergePendingPatch({}, "solution", "medicaid")).toEqual({ solution: "medicaid" });
    expect(normalizeFieldValue("solution", null)).toBeNull();
  });

  it("does not coerce other fields", () => {
    expect(normalizeFieldValue("customerName", "")).toBe("");
  });
});
