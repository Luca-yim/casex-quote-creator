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

/** Headline totals: TCV price walk for ballpark, implementation fee for proposal. */
export function PdfExecutiveSummary({ context }: PdfSectionProps) {
  const { quote, pricing, version } = context;

  return (
    <Page size="LETTER" style={styles.page}>
      <PdfHeader quoteName={quote.name} />

      {pricing.kind === "ballpark" ? (
        <>
          <PdfSection title="Executive Summary">
            <Text style={styles.label}>Total contract value</Text>
            <Text style={styles.displayNumber}>
              {formatCurrency(pricing.breakdown.finalTCV)}
            </Text>
            <Text style={styles.lead}>
              Contract term: {pricing.breakdown.contractYears}{" "}
              {pricing.breakdown.contractYears === 1 ? "year" : "years"}
            </Text>

            <View style={styles.spacerMd} />
            <View style={styles.columns}>
              <View style={[styles.card, styles.column]}>
                <Text style={styles.label}>One-time cost</Text>
                <Text style={styles.mono}>
                  {formatCurrency(pricing.breakdown.oneTimeTotal)}
                </Text>
              </View>
              <View style={[styles.card, styles.column]}>
                <Text style={styles.label}>Monthly recurring</Text>
                <Text style={styles.mono}>
                  {formatCurrency(pricing.breakdown.monthlyRecurring)}
                </Text>
              </View>
              <View style={[styles.card, styles.column]}>
                <Text style={styles.label}>Annual recurring</Text>
                <Text style={styles.mono}>
                  {formatCurrency(pricing.breakdown.annualRecurring)}
                </Text>
              </View>
            </View>
          </PdfSection>

          <PdfSection title="Price Walk">
            <MetaRow
              label="Baseline TCV"
              value={formatCurrency(pricing.breakdown.baselineTCV)}
            />
            {pricing.breakdown.repeatableActivationAdjustment !== 0 ? (
              <MetaRow
                label="Repeatability adjustment"
                value={formatCurrency(pricing.breakdown.repeatableActivationAdjustment)}
              />
            ) : null}
            <MetaRow
              label="Adjusted baseline"
              value={formatCurrency(pricing.breakdown.adjustedBaseline)}
            />
            {context.version === "internal" ? (
              <MetaRow
                label="Estimator margin"
                value={`${pricing.breakdown.marginPercent}%`}
              />
            ) : null}
            {context.version === "internal" && context.quote.marginJustification ? (
              <MetaRow
                label="Margin justification"
                value={context.quote.marginJustification}
              />
            ) : null}
            <MetaRow label="Final TCV" value={formatCurrency(pricing.breakdown.finalTCV)} />
          </PdfSection>
        </>
      ) : (
        <PdfSection title="Executive Summary">
          <Text style={styles.label}>Total implementation fee</Text>
          <Text style={styles.displayNumber}>
            {formatCurrency(pricing.totalImplementationFee)}
          </Text>

          {context.version === "internal" && context.pricing.kind === "proposal" ? (
            <>
              <View style={styles.spacerMd} />
              <MetaRow
                label="Grand total cost"
                value={formatCurrency(context.pricing.grandTotalCost)}
              />
              <MetaRow
                label="Estimator margin"
                value={`${context.pricing.marginPercent}%`}
              />
              <MetaRow
                label="Contingency"
                value={`${(context.pricing.contingencyPct * 100).toFixed(1)}%`}
              />
              {context.quote.marginJustification ? (
                <MetaRow
                  label="Margin justification"
                  value={context.quote.marginJustification}
                />
              ) : null}
            </>
          ) : null}
        </PdfSection>
      )}

      <PdfFooter version={version} />
    </Page>
  );
}
