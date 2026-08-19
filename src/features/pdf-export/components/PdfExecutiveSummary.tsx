import { Page, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/utils";
import { styles } from "../styles/styles";
import type { PdfSectionProps } from "../types";
import { PdfFooter } from "./PdfFooter";
import { PdfHeader } from "./PdfHeader";
import { PdfSection } from "./PdfSection";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaKey}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

/** Headline TCV, recurring breakdown and the price walk. */
export function PdfExecutiveSummary({ context }: PdfSectionProps) {
  const { quote, breakdown, version } = context;
  const isInternal = version === "internal";

  return (
    <Page size="LETTER" style={styles.page}>
      <PdfHeader quoteName={quote.name} />

      <PdfSection title="Executive Summary">
        <Text style={styles.label}>Total contract value</Text>
        <Text style={styles.displayNumber}>{formatCurrency(breakdown.finalTCV)}</Text>
        <Text style={styles.lead}>
          Contract term: {breakdown.contractYears}{" "}
          {breakdown.contractYears === 1 ? "year" : "years"}
        </Text>

        <View style={styles.spacerMd} />
        <View style={styles.columns}>
          <View style={[styles.card, styles.column]}>
            <Text style={styles.label}>One-time cost</Text>
            <Text style={styles.mono}>{formatCurrency(breakdown.oneTimeTotal)}</Text>
          </View>
          <View style={[styles.card, styles.column]}>
            <Text style={styles.label}>Monthly recurring</Text>
            <Text style={styles.mono}>{formatCurrency(breakdown.monthlyRecurring)}</Text>
          </View>
          <View style={[styles.card, styles.column]}>
            <Text style={styles.label}>Annual recurring</Text>
            <Text style={styles.mono}>{formatCurrency(breakdown.annualRecurring)}</Text>
          </View>
        </View>
      </PdfSection>

      <PdfSection title="Price Walk">
        <MetaRow label="Baseline TCV" value={formatCurrency(breakdown.baselineTCV)} />
        {breakdown.repeatableActivationAdjustment !== 0 ? (
          <MetaRow
            label="Repeatability adjustment"
            value={formatCurrency(breakdown.repeatableActivationAdjustment)}
          />
        ) : null}
        <MetaRow label="Adjusted baseline" value={formatCurrency(breakdown.adjustedBaseline)} />
        {isInternal ? (
          <MetaRow label="Estimator margin" value={`${breakdown.marginPercent}%`} />
        ) : null}
        {isInternal && quote.marginJustification ? (
          <MetaRow label="Margin justification" value={quote.marginJustification} />
        ) : null}
        <MetaRow label="Final TCV" value={formatCurrency(breakdown.finalTCV)} />
      </PdfSection>

      <PdfFooter version={version} />
    </Page>
  );
}
