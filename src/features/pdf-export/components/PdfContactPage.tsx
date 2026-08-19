import { Page, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { styles } from "../styles/styles";
import type { PdfSectionProps } from "../types";
import { PdfFooter } from "./PdfFooter";
import { PdfHeader } from "./PdfHeader";
import { PdfSection } from "./PdfSection";

const BOILERPLATE =
  "This estimate is valid for 60 days from date of issue. Speridian reserves the right to update pricing based on final scope, integrations discovered during discovery, and infrastructure requirements. All engagements are governed by a mutually executed Master Services Agreement.";

/** Contacts, standard terms and the generation identifier. */
export function PdfContactPage({ context }: PdfSectionProps) {
  const { quote, salesRep, estimator, generatedAt, version } = context;
  const shortId = quote.id.slice(0, 8);

  return (
    <Page size="LETTER" style={styles.page}>
      <PdfHeader quoteName={quote.name} />

      <PdfSection title="Contacts & Terms">
        <View style={styles.columns}>
          <View style={[styles.card, styles.column]}>
            <Text style={styles.label}>Prepared by</Text>
            <Text style={styles.body}>{salesRep.name}</Text>
            <Text style={styles.caption}>{salesRep.email}</Text>
          </View>
          <View style={[styles.card, styles.column]}>
            <Text style={styles.label}>Reviewed by</Text>
            <Text style={styles.body}>{estimator.name}</Text>
            <Text style={styles.caption}>{estimator.email}</Text>
          </View>
        </View>

        <View style={styles.spacerMd} />
        <Text style={styles.caption}>
          Prepared by {salesRep.name} · Reviewed by {estimator.name}
        </Text>
      </PdfSection>

      <PdfSection title="Standard Terms">
        <Text style={styles.disclaimer}>{BOILERPLATE}</Text>
      </PdfSection>

      <View style={styles.spacerLg} />
      <Text style={styles.caption}>
        Generated {format(generatedAt, "MMMM d, yyyy")} · Version {version} · Quote ID{" "}
        {shortId}
      </Text>

      <PdfFooter version={version} />
    </Page>
  );
}
