import type { Assumption } from "@/lib/assumptions-builder";
import type { PricingBreakdown } from "@/types/pricing";
import type { Quote } from "@/types/quote";

/** Which audience a generated PDF is intended for. */
export type PdfVersion = "customer" | "internal";

/** A named contact rendered on the cover and contact pages. */
export interface PdfContact {
  name: string;
  email: string;
}

/** Everything the PDF tree needs. Sub-components never fetch data themselves. */
export interface PdfContext {
  quote: Quote;
  breakdown: PricingBreakdown;
  assumptions: Assumption[];
  salesRep: PdfContact;
  estimator: PdfContact;
  generatedAt: Date;
  version: PdfVersion;
}

/** Standard prop shape for every PDF section/page component. */
export interface PdfSectionProps {
  context: PdfContext;
}
