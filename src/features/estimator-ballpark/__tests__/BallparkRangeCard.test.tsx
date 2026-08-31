import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/test-utils";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import type { Quote } from "@/types/quote";
import { IntakeProvider, type IntakeContextValue } from "@/features/intake/IntakeContext";
import { BallparkRangeCard } from "../BallparkRangeCard";
import type { BallparkSizingRow } from "@/lib/pricing-engine/ballpark";

/**
 * Same tier-3 public-sector band as the Alaska DOLWD pricing-engine fixture
 * (`src/lib/pricing-engine/__fixtures__/ballpark-alaska-wc.test.ts`), so this
 * test also checks the wiring against real reference numbers.
 */
const sizing: BallparkSizingRow[] = [
  {
    tier: 3,
    program_type: "public_sector",
    hours_low: 30_000,
    hours_high: 45_000,
    rate_low: 70,
    rate_high: 85,
  },
];

vi.mock("../useBallparkSizingReference", () => ({
  useBallparkSizingReference: () => ({ data: sizing, isLoading: false }),
}));

function renderCard(overrides: Partial<Quote>) {
  const quote = { ...makeQuote(), ...overrides } as Quote;
  const value = {
    quoteId: quote.id,
    quote,
    role: "estimator",
    mode: "readonly",
    showPricing: true,
    updateField: vi.fn(),
    flushSave: vi.fn(),
    isSaving: false,
    lastSavedAt: null,
    hasPendingChanges: false,
    validationErrors: {},
  } as unknown as IntakeContextValue;
  return render(
    <IntakeProvider value={value}>
      <BallparkRangeCard />
    </IntakeProvider>,
  );
}

describe("BallparkRangeCard", () => {
  it("shows a not-enough-information state when no driver inputs are answered", () => {
    renderCard({
      customerType: "state_naspo",
      hasIntegrations: null,
      migrationRequired: null,
      externalIdpRequired: null,
      workerIdpRequired: null,
      includeB2c: null,
      includeB2bPortal: null,
      compliance: null,
    } as unknown as Partial<Quote>);

    expect(
      screen.getByText(/not enough information yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });

  it("renders the Alaska-fixture tier 3 range with full driver inputs", async () => {
    const user = userEvent.setup();
    // integration medium(2) + migration medium(2) + identity high(3)
    // + portal medium(2) + compliance high(3) = 12 => tier 3, all answered
    // => 100% confidence => no widening.
    renderCard({
      customerType: "state_naspo",
      hasIntegrations: true,
      integrationCount: 3,
      integrationDifficulty: "moderate",
      migrationRequired: true,
      migrationVolumeRange: "100k-1m",
      migrationCleanupRequired: false,
      externalIdpRequired: true,
      workerIdpRequired: true,
      idpDocumented: true,
      includeB2c: true,
      includeB2bPortal: false,
      portalFormCountRange: "4-10",
      compliance: ["soc2_type2", "hipaa", "stateramp"],
    } as unknown as Partial<Quote>);

    expect(screen.getByText(/\$2,100,000\s*[–-]\s*\$3,825,000/)).toBeInTheDocument();
    expect(screen.getByText("Tier 3")).toBeInTheDocument();
    expect(screen.getByText("100% confidence")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /driver breakdown/i }));
    expect(screen.getByText("Integration")).toBeInTheDocument();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
  });
});
