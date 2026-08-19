import { Page, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";
import { styles } from "../styles/styles";
import type { PdfSectionProps } from "../types";
import { PdfBadge } from "./PdfBadge";
import { PdfFooter } from "./PdfFooter";

const DISCLAIMER =
  "This is a non-binding estimate for planning purposes. Final pricing subject to negotiation and executed agreement.";

/** Full-page cover with reference block, contacts and tier badge. */
export function PdfCoverPage({ context }: PdfSectionProps) {
  const { quote, salesRep, estimator, generatedAt, version } = context;
  const isInternal = version === "internal";

  return (
    <Page size="LETTER" style={styles.coverPage}>
      {isInternal ? (
        <View style={styles.internalBanner}>
          <Text style={styles.internalBannerText}>INTERNAL — DO NOT DISTRIBUTE</Text>
        </View>
      ) : null}

      <View style={styles.coverBody}>
        {/* TODO: replace with logo asset */}
        <Text style={styles.coverWordmark}>CaseXellence</Text>
        <View style={styles.spacerLg} />

        <Text style={styles.h1}>Pricing Estimate</Text>
        <Text style={styles.lead}>{quote.customerName ?? "Customer organization"}</Text>
        <View style={styles.spacerMd} />
        <PdfBadge
          label={quote.tier === "proposal" ? "Proposal" : "Ballpark Estimate"}
          variant={quote.tier === "proposal" ? "proposal" : "ballpark"}
        />

        <View style={styles.spacerLg} />
        <View style={styles.card}>
          <Text style={styles.label}>Reference</Text>
          <Text style={styles.body}>{quote.name}</Text>
          <Text style={styles.caption}>Quote ID {quote.id}</Text>
        </View>

        <View style={styles.spacerLg} />
        <View style={styles.columns}>
          <View style={styles.column}>
            <Text style={styles.label}>Prepared for</Text>
            <Text style={styles.body}>{quote.customerName ?? "—"}</Text>
            <Text style={styles.caption}>{quote.customerEmail ?? ""}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Prepared by</Text>
            <Text style={styles.body}>{salesRep.name}</Text>
            <Text style={styles.caption}>{salesRep.email}</Text>
          </View>
          <View style={styles.column}>
            <Text style={styles.label}>Reviewed by</Text>
            <Text style={styles.body}>{estimator.name}</Text>
            <Text style={styles.caption}>{estimator.email}</Text>
          </View>
        </View>

        <View style={styles.spacerLg} />
        <Text style={styles.label}>Date issued</Text>
        <Text style={styles.body}>{format(generatedAt, "MMMM d, yyyy")}</Text>

        <View style={styles.spacerLg} />
        <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
      </View>

      <PdfFooter version={version} />
    </Page>
  );
}
