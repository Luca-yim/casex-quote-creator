import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles/styles";

function truncate(value: string, max = 42): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Band rendered at the top of every non-cover page. */
export function PdfHeader({ quoteName }: { quoteName: string }) {
  return (
    <View style={styles.header} fixed>
      {/* TODO: replace with logo asset */}
      <Text style={styles.wordmark}>CaseXellence</Text>
      <Text style={styles.caption}>
        {truncate(quoteName)} ·{" "}
        <Text render={({ pageNumber }) => `Page ${pageNumber}`} />
      </Text>
    </View>
  );
}
