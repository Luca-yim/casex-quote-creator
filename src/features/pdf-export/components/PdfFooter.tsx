import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles/styles";
import type { PdfVersion } from "../types";

/** Band rendered at the bottom of every page. */
export function PdfFooter({ version }: { version: PdfVersion }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerSide}> </Text>
      <Text style={styles.footerCenter}>Confidential — Speridian</Text>
      <Text style={styles.footerSideRight}>
        {version === "internal" ? "INTERNAL — DO NOT DISTRIBUTE" : " "}
      </Text>
    </View>
  );
}
