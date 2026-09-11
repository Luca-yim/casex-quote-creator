import { Image, Text, View } from "@react-pdf/renderer";
import { CASEX_LOGO_DATA_URI } from "@/assets/casex-logo";
import { styles } from "../styles/styles";

function truncate(value: string, max = 42): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Band rendered at the top of every non-cover page. */
export function PdfHeader({ quoteName }: { quoteName: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.pdfBrand}>
        <Image src={CASEX_LOGO_DATA_URI} style={styles.headerLogo} />
        <Text style={styles.wordmark}>CaseXellence</Text>
      </View>
      <Text
        style={styles.caption}
        render={({ pageNumber }) => `${truncate(quoteName)} · Page ${pageNumber}`}
      />
    </View>
  );
}
