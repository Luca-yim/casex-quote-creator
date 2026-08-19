import { Page, Text } from "@react-pdf/renderer";
import { styles } from "../styles/styles";
import type { PdfSectionProps } from "../types";
import { PdfFooter } from "./PdfFooter";
import { PdfHeader } from "./PdfHeader";
import { PdfLineItemTable } from "./PdfLineItemTable";
import { PdfSection } from "./PdfSection";

/** Grouped line item tables for one-time and monthly recurring costs. */
export function PdfLineItemsPage({ context }: PdfSectionProps) {
  const { quote, breakdown, version } = context;
  const oneTime = breakdown.lineItems.filter((i) => i.category === "one_time");
  const monthly = breakdown.lineItems.filter((i) => i.category === "monthly");

  return (
    <Page size="LETTER" style={styles.page}>
      <PdfHeader quoteName={quote.name} />

      <PdfSection title="Line Item Detail">
        {oneTime.length === 0 && monthly.length === 0 ? (
          <Text style={styles.body}>No priced line items on this quote.</Text>
        ) : null}
        <PdfLineItemTable
          title="One-Time Costs"
          items={oneTime}
          totalLabel="One-time subtotal"
        />
        <PdfLineItemTable
          title="Monthly Recurring"
          items={monthly}
          totalLabel="Monthly subtotal"
        />
      </PdfSection>

      <PdfFooter version={version} />
    </Page>
  );
}
