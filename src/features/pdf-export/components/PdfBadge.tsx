import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles/styles";

export type PdfBadgeVariant = "ballpark" | "proposal" | "internal" | "neutral";

const VARIANTS = {
  ballpark: [styles.badgeBallpark, styles.badgeBallparkText],
  proposal: [styles.badgeProposal, styles.badgeProposalText],
  internal: [styles.badgeInternal, styles.badgeInternalText],
  neutral: [styles.badgeNeutral, styles.badgeNeutralText],
} as const;

/** Small colored pill used for tier/status labels. */
export function PdfBadge({
  label,
  variant = "neutral",
}: {
  label: string;
  variant?: PdfBadgeVariant;
}) {
  const [box, text] = VARIANTS[variant];
  return (
    <View style={[styles.badge, box]}>
      <Text style={[styles.badgeText, text]}>{label}</Text>
    </View>
  );
}
