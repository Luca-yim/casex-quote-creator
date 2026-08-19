import { Page, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import type { Assumption } from "@/lib/assumptions-builder";
import { styles } from "../styles/styles";
import type { PdfSectionProps } from "../types";
import { PdfFooter } from "./PdfFooter";
import { PdfHeader } from "./PdfHeader";
import { PdfSection } from "./PdfSection";

const TONE_MARK: Record<Assumption["tone"], string> = {
  info: "i",
  success: "+",
  warning: "!",
};

const TONE_STYLE = {
  info: styles.toneInfo,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
} as const;

const ACTIVATION_LABELS: Record<string, string> = {
  full_match: "Full match",
  partial_match: "Partial match",
  novel: "Novel solution",
};

const HOSTING_LABELS: Record<string, string> = {
  soc2: "SOC 2 cloud",
  fedramp: "FedRAMP cloud",
  customer_hosted: "Customer hosted",
};

const COMPLIANCE_LABELS: Record<string, string> = {
  fedramp_moderate: "FedRAMP Moderate",
  fedramp_high: "FedRAMP High",
  soc2_type2: "SOC 2 Type 2",
  hipaa: "HIPAA",
  cjis: "CJIS",
  stateramp: "StateRAMP",
  irs_1075: "IRS 1075",
};

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaKey}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

/** Assumption bullets plus the quote configuration metadata block. */
export function PdfAssumptionsPage({ context }: PdfSectionProps) {
  const { quote, assumptions, version } = context;
  const isInternal = version === "internal";

  return (
    <Page size="LETTER" style={styles.page}>
      <PdfHeader quoteName={quote.name} />

      <PdfSection title="Assumptions & Notes">
        {assumptions.length === 0 ? (
          <Text style={styles.body}>No additional assumptions recorded.</Text>
        ) : (
          assumptions.map((assumption) => (
            <View key={assumption.id} style={styles.bulletRow}>
              <Text style={[styles.bulletMark, TONE_STYLE[assumption.tone]]}>
                {TONE_MARK[assumption.tone]}
              </Text>
              <Text style={styles.bulletText}>{assumption.text}</Text>
            </View>
          ))
        )}
      </PdfSection>

      <PdfSection title="Quote Configuration">
        <MetaRow label="Vertical" value={quote.vertical ?? "Not specified"} />
        <MetaRow label="Solution" value={quote.solution ?? "Not specified"} />
        <MetaRow
          label="Repeatable activation"
          value={ACTIVATION_LABELS[quote.repeatableActivation] ?? "Not specified"}
        />
        <MetaRow
          label="Compliance"
          value={
            quote.compliance.length > 0
              ? quote.compliance.map(titleCase).join(", ")
              : "None specified"
          }
        />
        <MetaRow
          label="Hosting"
          value={quote.hostingModel ? (HOSTING_LABELS[quote.hostingModel] ?? "—") : "Not specified"}
        />
        <MetaRow
          label="Support tier"
          value={quote.supportTier ? titleCase(quote.supportTier) : "Not specified"}
        />
        <MetaRow
          label="Target go-live"
          value={
            quote.targetGoLiveDate
              ? format(new Date(quote.targetGoLiveDate), "MMMM d, yyyy")
              : "Not specified"
          }
        />
        {isInternal ? (
          <MetaRow
            label="Rep confidence"
            value={quote.repConfidence ? titleCase(quote.repConfidence) : "Not specified"}
          />
        ) : null}
      </PdfSection>

      <PdfFooter version={version} />
    </Page>
  );
}
