import { Text, View } from "@react-pdf/renderer";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { LineItem } from "@/types/pricing";
import { styles } from "../styles/styles";

export interface PdfLineItemTableProps {
  title: string;
  items: LineItem[];
  /** Render the table (with an empty note) even when there are no items. */
  showEmpty?: boolean;
  /** Label used on the subtotal row. */
  totalLabel?: string;
}

/** Fixed-column table of line items with a subtotal row. */
export function PdfLineItemTable({
  title,
  items,
  showEmpty = false,
  totalLabel = "Subtotal",
}: PdfLineItemTableProps) {
  if (items.length === 0 && !showEmpty) return null;

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.tableTitle}>{title}</Text>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
        <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
        <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unit price</Text>
        <Text style={[styles.tableHeaderCell, styles.colSubtotal]}>Subtotal</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.tableRow}>
          <Text style={[styles.tableCellMuted, styles.colItem]}>No items</Text>
        </View>
      ) : (
        items.map((item, index) => (
          <View
            key={item.id}
            style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
          >
            <View style={styles.colItem}>
              <Text style={styles.tableCell}>{item.label}</Text>
              {item.notes ? <Text style={styles.tableCellMuted}>{item.notes}</Text> : null}
            </View>
            <Text style={[styles.tableCellNumeric, styles.colQty]}>
              {formatNumber(item.quantity)}
            </Text>
            <Text style={[styles.tableCellNumeric, styles.colUnit]}>
              {formatCurrency(item.unitPrice)}
            </Text>
            <Text style={[styles.tableCellNumeric, styles.colSubtotal]}>
              {formatCurrency(item.subtotal)}
            </Text>
          </View>
        ))
      )}

      <View style={styles.tableTotalRow}>
        <Text style={[styles.tableTotalLabel, styles.colItem]}>{totalLabel}</Text>
        <Text style={[styles.tableTotalValue, styles.colSubtotal]}>
          {formatCurrency(total)}
        </Text>
      </View>
    </View>
  );
}
