import { Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { styles } from "../styles/styles";
import type { PdfSectionProps } from "../types";
import { PdfFooter } from "./PdfFooter";
import { PdfHeader } from "./PdfHeader";
import { PdfLineItemTable } from "./PdfLineItemTable";
import { PdfSection } from "./PdfSection";

/**
 * Line item detail.
 *
 * - Ballpark tier: catalog line item tables (unchanged for both audiences).
 * - Proposal tier, customer: a single "Implementation Fee" summary row. No
 *   WBS rows, rates, margin or contingency reach this branch at all.
 * - Proposal tier, internal: full WBS labor and non-labor cost detail.
 */
export function PdfLineItemsPage({ context }: PdfSectionProps) {
  const { quote, pricing, version } = context;

  return (
    <Page size="LETTER" style={styles.page}>
      <PdfHeader quoteName={quote.name} />

      {pricing.kind === "ballpark" ? (
        <BallparkDetail context={context} />
      ) : context.version === "internal" ? (
        <InternalProposalDetail pricing={context.pricing} />
      ) : (
        <PdfSection title="Investment Summary">
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
            <Text style={[styles.tableHeaderCell, styles.colSubtotal]}>Amount</Text>
          </View>
          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableTotalLabel, styles.colItem]}>Implementation Fee</Text>
            <Text style={[styles.tableTotalValue, styles.colSubtotal]}>
              {formatCurrency(
                pricing.kind === "proposal" ? pricing.totalImplementationFee : 0,
              )}
            </Text>
          </View>
        </PdfSection>
      )}

      <PdfFooter version={version} />
    </Page>
  );
}

function BallparkDetail({ context }: PdfSectionProps) {
  if (context.pricing.kind !== "ballpark") return null;
  const { breakdown } = context.pricing;
  const oneTime = breakdown.lineItems.filter((i) => i.category === "one_time");
  const monthly = breakdown.lineItems.filter((i) => i.category === "monthly");

  return (
    <PdfSection title="Line Item Detail">
      {oneTime.length === 0 && monthly.length === 0 ? (
        <Text style={styles.body}>No priced line items on this quote.</Text>
      ) : null}
      <PdfLineItemTable title="One-Time Costs" items={oneTime} totalLabel="One-time subtotal" />
      <PdfLineItemTable title="Monthly Recurring" items={monthly} totalLabel="Monthly subtotal" />
    </PdfSection>
  );
}

function InternalProposalDetail({
  pricing,
}: {
  pricing: import("../types").BallparkPricing | import("../types").ProposalPricingInternal;
}) {
  if (pricing.kind !== "proposal") return null;

  return (
    <>
      <PdfSection title="Work Breakdown (Internal)">
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, styles.colItem]}>Phase / Role</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Hours</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>Cost rate</Text>
          <Text style={[styles.tableHeaderCell, styles.colSubtotal]}>Cost</Text>
        </View>
        {pricing.lines.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCellMuted, styles.colItem]}>No WBS lines</Text>
          </View>
        ) : (
          pricing.lines.map((line, index) => (
            <View
              key={line.id}
              style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={[styles.tableCell, styles.colItem]}>
                {line.phase} · {line.role} ({line.location})
              </Text>
              <Text style={[styles.tableCellNumeric, styles.colQty]}>
                {formatNumber(line.costHours)}
              </Text>
              <Text style={[styles.tableCellNumeric, styles.colUnit]}>
                {formatCurrency(line.costRate)}
              </Text>
              <Text style={[styles.tableCellNumeric, styles.colSubtotal]}>
                {formatCurrency(line.costHours * line.costRate)}
              </Text>
            </View>
          ))
        )}
      </PdfSection>

      <PdfSection title="Other Costs (Internal)">
        {pricing.items.length === 0 ? (
          <Text style={styles.body}>No non-labor cost items.</Text>
        ) : (
          pricing.items.map((item, index) => (
            <View
              key={item.id}
              style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={[styles.tableCell, styles.colItem]}>
                {item.name} ({item.itemType})
              </Text>
              <Text style={[styles.tableCellNumeric, styles.colSubtotal]}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))
        )}
        <View style={styles.tableTotalRow}>
          <Text style={[styles.tableTotalLabel, styles.colItem]}>Grand total cost</Text>
          <Text style={[styles.tableTotalValue, styles.colSubtotal]}>
            {formatCurrency(pricing.grandTotalCost)}
          </Text>
        </View>
      </PdfSection>
    </>
  );
}
