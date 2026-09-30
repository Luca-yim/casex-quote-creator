import type { Quote } from "@/types/quote";
import { suggestedContingency } from "./fullQuote";
import { mapQuoteToDrivers } from "./mapQuoteToDrivers";

export interface ResolvedContingency {
  /** Fraction (0–1) to price with. */
  pct: number;
  /** True when nothing is stored and the driver-based suggestion is used. */
  isSuggested: boolean;
}

/**
 * The single contingency rule shared by the sidebar and both PDFs.
 * `null` means "never set" → use the suggestion. `0` is a deliberate zero
 * and is honoured.
 */
export function resolveContingency(quote: Quote): ResolvedContingency {
  if (quote.contingencyPct !== null && quote.contingencyPct !== undefined) {
    return { pct: quote.contingencyPct, isSuggested: false };
  }
  const d = mapQuoteToDrivers(quote);
  return {
    pct: suggestedContingency({
      migrationComplexity: d.migration,
      complianceComplexity: d.compliance,
      hasUndocumentedIntegration: d.hasUndocumentedIntegration,
    }),
    isSuggested: true,
  };
}
