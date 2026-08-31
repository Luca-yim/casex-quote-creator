import type { Assumption } from "@/lib/assumptions-builder";
import type { CostItemRow, WbsLineRow } from "@/features/wbs/useWbsData";
import type { PricingBreakdown } from "@/types/pricing";
import type { Quote } from "@/types/quote";

/** Which audience a generated PDF is intended for. */
export type PdfVersion = "customer" | "internal";

/** A named contact rendered on the cover and contact pages. */
export interface PdfContact {
  name: string;
  email: string;
}

/**
 * The ONLY quote fields a customer-facing PDF may ever see. Anything not
 * listed here is unreachable from the customer render tree by construction.
 */
export interface CustomerQuoteFields {
  id: string;
  name: string;
  customerName: string | null;
  customerEmail: string | null;
  tier: Quote["tier"];
}

/**
 * Non-pricing scope metadata rendered on the configuration block. Safe for
 * both audiences: it carries no cost basis, rates, margin or contingency.
 */
export interface PdfQuoteConfiguration {
  vertical: string | null;
  solution: string | null;
  repeatableActivation: string;
  compliance: string[];
  hostingModel: string | null;
  supportTier: string | null;
  targetGoLiveDate: string | null;
}

/** Ballpark-tier pricing: the legacy catalog-engine breakdown, unchanged. */
export interface BallparkPricing {
  kind: "ballpark";
  breakdown: PricingBreakdown;
}

/** Proposal-tier pricing as a customer may see it: the final fee only. */
export interface ProposalPricingCustomer {
  kind: "proposal";
  totalImplementationFee: number;
}

/** Proposal-tier pricing with full cost basis. Internal audience only. */
export interface ProposalPricingInternal {
  kind: "proposal";
  grandTotalCost: number;
  marginPercent: number;
  contingencyPct: number;
  totalImplementationFee: number;
  lines: WbsLineRow[];
  items: CostItemRow[];
}

interface PdfDataBase {
  assumptions: Assumption[];
  configuration: PdfQuoteConfiguration;
  salesRep: PdfContact;
  estimator: PdfContact;
  generatedAt: Date;
}

/** Everything a customer-facing PDF render is allowed to receive. */
export interface CustomerVisiblePdfData extends PdfDataBase {
  version: "customer";
  quote: CustomerQuoteFields;
  pricing: BallparkPricing | ProposalPricingCustomer;
}

/** Superset available to internal PDFs only. */
export interface InternalPdfData extends PdfDataBase {
  version: "internal";
  quote: Quote;
  pricing: BallparkPricing | ProposalPricingInternal;
}

/**
 * Structural audience boundary. Reaching WBS rows, rates, margin or
 * contingency requires narrowing on `version` AND `pricing.kind`, so a leak
 * into the customer tree is a compile error rather than a review miss.
 */
export type PdfData = CustomerVisiblePdfData | InternalPdfData;

/** Back-compat alias: the PDF tree's single context type. */
export type PdfContext = PdfData;

/** Standard prop shape for every PDF section/page component. */
export interface PdfSectionProps {
  context: PdfData;
}
