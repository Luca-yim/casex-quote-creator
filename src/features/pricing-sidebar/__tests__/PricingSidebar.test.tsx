import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { formatCurrency } from "@/lib/utils";
import { computeBallparkForQuote } from "@/features/estimator-ballpark/computeBallparkForQuote";
import type { BallparkSizingRow } from "@/lib/pricing-engine/ballpark";

const SIZING: BallparkSizingRow[] = [1, 2, 3, 4].map((tier) => ({
  tier: tier as 1 | 2 | 3 | 4,
  tier_label: `Tier ${tier}`,
  hours_low: 500 * tier,
  hours_high: 900 * tier,
  commercial_rate_low: 180,
  commercial_rate_high: 220,
  public_sector_rate_low: 150,
  public_sector_rate_high: 190,
}));

const intakeState = vi.hoisted(() => ({ current: null as any }));

vi.mock("@/features/intake/IntakeContext", () => ({
  useIntake: () => intakeState.current,
}));

vi.mock("@/hooks/usePricingCatalog", () => ({
  usePricingCatalog: () => ({ data: [] }),
}));

vi.mock("@/features/wbs/useWbsData", () => ({
  useWbsLines: () => ({ data: [] }),
  useQuoteCostItems: () => ({ data: [] }),
}));

vi.mock("@/features/estimator-ballpark/useBallparkSizingReference", () => ({
  useBallparkSizingReference: () => ({ data: SIZING, isLoading: false }),
}));

vi.mock("@/lib/calculation-engine", () => ({
  calculatePricingBreakdown: () => ({
    lineItems: [
      {
        id: "module",
        label: "Module tier",
        category: "one_time",
        quantity: 1,
        subtotal: 100_000,
      },
    ],
    oneTimeTotal: 100_000,
    monthlyRecurring: 5_000,
    contractYears: 3,
    baselineTCV: 280_000,
    finalTCV: 280_000,
    repeatableActivationAdjustment: 0,
  }),
}));

/** A ballpark quote with enough answered drivers to produce a range. */
function answeredQuote(overrides = {}) {
  return makeQuote({
    tier: "ballpark",
    customerType: "state_naspo",
    hasIntegrations: true,
    integrationCount: 4,
    integrationDifficulty: "moderate",
    migrationRequired: true,
    compliance: ["soc2_type2"],
    ...overrides,
  });
}

function renderSidebar(quote: any, extra: Record<string, unknown> = {}) {
  intakeState.current = {
    quote,
    role: "estimator",
    mode: "edit",
    showPricing: true,
    isSaving: false,
    lastSavedAt: null,
    updateField: vi.fn(),
    ...extra,
  };
  return render(<PricingSidebar />);
}

// Imported after mocks are registered.
import { PricingSidebar } from "../PricingSidebar";

describe("PricingSidebar implementation fee row", () => {
  beforeEach(() => {
    intakeState.current = null;
  });

  it("renders the estimated range for a ballpark quote with driver info", () => {
    const quote = answeredQuote();
    const expected = computeBallparkForQuote(quote as any, SIZING);
    expect(expected).not.toBeNull();

    renderSidebar(quote);

    expect(
      screen.getByText("Implementation Fee (Estimated)"),
    ).toBeInTheDocument();
    const row = screen
      .getByText("Implementation Fee (Estimated)")
      .closest("div")!;
    expect(row.textContent).toContain(
      formatCurrency(expected!.implementationLow),
    );
    expect(row.textContent).toContain(
      formatCurrency(expected!.implementationHigh),
    );
  });

  it("renders nothing when there is not enough driver information", () => {
    const quote = makeQuote({
      tier: "ballpark",
      customerType: null,
      hasIntegrations: null,
      migrationRequired: null,
      externalIdpRequired: null,
      workerIdpRequired: null,
      includeB2c: null,
      includeB2bPortal: null,
      compliance: [],
    } as any);

    renderSidebar(quote);

    expect(
      screen.queryByText("Implementation Fee (Estimated)"),
    ).not.toBeInTheDocument();
  });

  it("never renders for proposal-tier quotes", () => {
    renderSidebar(answeredQuote({ tier: "proposal" }));

    expect(
      screen.queryByText("Implementation Fee (Estimated)"),
    ).not.toBeInTheDocument();
  });

  it("sits directly below One-time cost and above Monthly recurring", () => {
    renderSidebar(answeredQuote());

    const labels = Array.from(
      document.querySelectorAll("span.text-muted-foreground"),
    ).map((n) => n.textContent);
    const oneTime = labels.indexOf("One-time cost");
    const fee = labels.indexOf("Implementation Fee (Estimated)");
    const monthly = labels.indexOf("Monthly recurring");
    expect(oneTime).toBeGreaterThanOrEqual(0);
    expect(fee).toBe(oneTime + 1);
    expect(monthly).toBe(fee + 1);
  });
});
