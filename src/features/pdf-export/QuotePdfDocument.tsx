import { Document } from "@react-pdf/renderer";
import { PdfAssumptionsPage } from "./components/PdfAssumptionsPage";
import { PdfContactPage } from "./components/PdfContactPage";
import { PdfCoverPage } from "./components/PdfCoverPage";
import { PdfExecutiveSummary } from "./components/PdfExecutiveSummary";
import { PdfLineItemsPage } from "./components/PdfLineItemsPage";
import type { PdfContext } from "./types";

/**
 * Top-level PDF document. Page order and inclusion are controlled here only,
 * so reordering or dropping a page is a one-file change.
 */
export function QuotePdfDocument({ context }: { context: PdfContext }) {
  const { quote, version } = context;
  return (
    <Document
      title={`CaseX Pricing Estimate — ${quote.name}`}
      author="Speridian Technologies"
      subject={`${version} pricing estimate`}
    >
      <PdfCoverPage context={context} />
      <PdfExecutiveSummary context={context} />
      <PdfLineItemsPage context={context} />
      <PdfAssumptionsPage context={context} />
      <PdfContactPage context={context} />
    </Document>
  );
}
