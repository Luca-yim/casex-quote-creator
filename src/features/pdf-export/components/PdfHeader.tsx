import { Image, Text, View } from "@react-pdf/renderer";
import logoAsset from "@/assets/casex-logo.png.asset.json";
import { styles } from "../styles/styles";

function truncate(value: string, max = 42): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Band rendered at the top of every non-cover page. */
export function PdfHeader({ quoteName }: { quoteName: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.pdfBrand}>
        <Image src={logoAsset.url} style={styles.headerLogo} />
        <Text style={styles.wordmark}>CaseXellence</Text>
      </View>
      <Text
        style={styles.caption}
        render={({ pageNumber }) => `${truncate(quoteName)} · Page ${pageNumber}`}
      />
    </View>
  );
}
