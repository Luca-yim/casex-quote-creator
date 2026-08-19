import type { ReactNode } from "react";
import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles/styles";

/** Titled block with consistent spacing between sections. */
export function PdfSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionDivider}>
          <Text style={styles.h2}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}
