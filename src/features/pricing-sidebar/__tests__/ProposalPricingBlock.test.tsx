import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProposalPricingBlock } from "../ProposalPricingBlock";
import { makeQuote } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import { formatCurrency } from "@/lib/utils";
import {
  grandTotalCost,
  marginScenarios,
  totalImplementationFee,
} from "@/lib/pricing-engine/fullQuote";

const LINES = [
  { costHours: 1000, costRate: 80, revenueHours: 1000, billRate: 160 },
  { costHours: 600, costRate: 100, revenueHours: 600, billRate: 190 },
];
const ITEMS = [{ amount: 25_000 }];
const COST = grandTotalCost(LINES, ITEMS);
const HOURS = 1600;

function buildQuote(quoteOverrides = {}) {
  return makeQuote({
    tier: "proposal",
    marginPercent: 30,
    // Known driver inputs: high-volume migration with cleanup + undocumented IdP.
    migrationRequired: true,
    migrationVolumeRange: "1m-5m",
    migrationCleanupRequired: false,
    externalIdpRequired: true,
    workerIdpRequired: false,
    idpDocumented: false,
    ...quoteOverrides,
  });
}

function renderBlock(quoteOverrides = {}, onChange = vi.fn()) {
  const quote = buildQuote(quoteOverrides);
  const utils = render(
    <ProposalPricingBlock
      quote={quote}
      lines={LINES}
      items={ITEMS}
      totalHours={HOURS}
      canEdit
      onChange={onChange}
    />,
  );
  return { ...utils, quote, onChange };
}

describe("ProposalPricingBlock", () => {
  it("seeds the suggested contingency on first render when unset", () => {
    const onChange = vi.fn();
    renderBlock({ contingencyPct: null }, onChange);
    // base 3% + high migration 2% + undocumented integration 2% = 7%
    expect(onChange).toHaveBeenCalledWith(0.07);
    expect(screen.getByText("7%")).toBeInTheDocument();
  });

  it("does not overwrite an estimator-set contingency", () => {
    const onChange = vi.fn();
    renderBlock({ contingencyPct: 0.12 }, onChange);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("12%")).toBeInTheDocument();
  });

  it("shows the computed price from margin + contingency, not a scenario", () => {
    renderBlock({ contingencyPct: 0.1, marginPercent: 30 });
    const expected = totalImplementationFee(30, COST, 0.1);
    expect(screen.getByTestId("computed-price").textContent).toBe(
      formatCurrency(expected),
    );
  });

  it("updates the displayed price live when margin or contingency changes", () => {
    const onChange = vi.fn();
    const { rerender } = renderBlock({ contingencyPct: 0.1, marginPercent: 30 }, onChange);
    const first = screen.getByTestId("computed-price").textContent;

    rerender(
      <ProposalPricingBlock
        quote={buildQuote({ contingencyPct: 0.1, marginPercent: 40 })}
        lines={LINES}
        items={ITEMS}
        totalHours={HOURS}
        canEdit
        onChange={onChange}
      />,
    );
    const higherMargin = screen.getByTestId("computed-price").textContent;
    expect(higherMargin).toBe(formatCurrency(totalImplementationFee(40, COST, 0.1)));
    expect(higherMargin).not.toBe(first);

    rerender(
      <ProposalPricingBlock
        quote={buildQuote({ contingencyPct: 0.2, marginPercent: 40 })}
        lines={LINES}
        items={ITEMS}
        totalHours={HOURS}
        canEdit
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId("computed-price").textContent).toBe(
      formatCurrency(totalImplementationFee(40, COST, 0.2)),
    );
  });

  it("renders the four reference scenarios and they are non-interactive", () => {
    renderBlock({ contingencyPct: 0.05 });
    const rows = marginScenarios(COST, HOURS);
    expect(rows).toHaveLength(4);
    for (const s of rows) {
      const row = screen.getByTestId(`scenario-${Math.round(s.margin * 100)}`);
      expect(row).toBeInTheDocument();
      // Display only: no button, link, radio or click handler in the row.
      expect(row.querySelector("button, a, input, [role='button']")).toBeNull();
      expect(row.onclick).toBeNull();
    }
  });

  it("renders nothing for a ballpark-tier quote or with no cost basis", () => {
    const { container } = render(
      <ProposalPricingBlock
        quote={makeQuote({ tier: "ballpark", contingencyPct: 0.05 })}
        lines={LINES}
        items={ITEMS}
        totalHours={HOURS}
        canEdit
        onChange={vi.fn()}
      />,
    );
    expect(container.querySelector("[data-testid='proposal-pricing-block']")).toBeNull();

    const empty = render(
      <ProposalPricingBlock
        quote={makeQuote({ tier: "proposal", contingencyPct: 0.05 })}
        lines={[]}
        items={[]}
        totalHours={0}
        canEdit
        onChange={vi.fn()}
      />,
    );
    expect(
      empty.container.querySelector("[data-testid='proposal-pricing-block']"),
    ).toBeNull();
  });
});
