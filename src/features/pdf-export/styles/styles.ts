import { StyleSheet } from "@react-pdf/renderer";
import { theme } from "./theme";

/** Reusable PDF styles. Sub-components should not declare inline styles. */
export const styles = StyleSheet.create({
  page: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    paddingTop: theme.page.padding,
    paddingBottom: theme.page.padding + 16,
    paddingHorizontal: theme.page.padding,
  },
  coverPage: {
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    padding: 0,
  },
  coverBody: {
    paddingHorizontal: theme.page.padding + 12,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.page.padding,
    flexGrow: 1,
  },
  h1: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.h1,
    color: theme.colors.brand,
    marginBottom: theme.spacing.sm,
  },
  h2: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.h2,
    color: theme.colors.brand,
    marginBottom: theme.spacing.sm,
  },
  h3: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.h3,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  body: {
    fontSize: theme.fontSize.body,
    color: theme.colors.text,
    lineHeight: 1.5,
  },
  lead: {
    fontSize: theme.fontSize.lead,
    color: theme.colors.muted,
  },
  caption: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
  },
  label: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  mono: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
  },
  displayNumber: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.display,
    color: theme.colors.brand,
  },
  wordmark: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lead,
    color: theme.colors.brand,
    letterSpacing: 1,
  },
  coverWordmark: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    color: theme.colors.brand,
    letterSpacing: 1.5,
  },

  // Layout helpers
  row: { flexDirection: "row", alignItems: "center" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  columns: { flexDirection: "row", gap: theme.spacing.md },
  column: { flexGrow: 1, flexBasis: 0 },
  section: { marginBottom: theme.spacing.lg },
  sectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  spacerSm: { height: theme.spacing.sm },
  spacerMd: { height: theme.spacing.md },
  spacerLg: { height: theme.spacing.lg },

  // Header / footer bands
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: theme.page.padding,
    right: theme.page.padding,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.xs,
  },
  footerCenter: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    textAlign: "center",
    flexGrow: 1,
  },
  footerSide: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    width: 130,
  },
  footerSideRight: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.danger,
    width: 130,
    textAlign: "right",
  },

  // Banners
  internalBanner: {
    backgroundColor: theme.colors.danger,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.page.padding,
  },
  internalBannerText: {
    color: theme.colors.onBrand,
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.lead,
    letterSpacing: 1,
    textAlign: "center",
  },

  // Badges
  badge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: theme.fontSize.caption,
    fontFamily: theme.fonts.heading,
    letterSpacing: 0.5,
  },
  badgeBallpark: {
    backgroundColor: "#EFF6FF",
    borderColor: theme.colors.accentSoft,
  },
  badgeBallparkText: { color: theme.colors.accent },
  badgeProposal: {
    backgroundColor: "#ECFDF5",
    borderColor: theme.colors.success,
  },
  badgeProposalText: { color: "#047857" },
  badgeInternal: {
    backgroundColor: "#FEF2F2",
    borderColor: theme.colors.danger,
  },
  badgeInternalText: { color: theme.colors.danger },
  badgeNeutral: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  badgeNeutralText: { color: theme.colors.muted },

  // Tables
  tableTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.h3,
    marginBottom: theme.spacing.xs,
    color: theme.colors.text,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.brand,
    paddingVertical: 5,
    paddingHorizontal: theme.spacing.sm,
  },
  tableHeaderCell: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.onBrand,
    fontFamily: theme.fonts.heading,
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableRowAlt: { backgroundColor: theme.colors.surface },
  tableCell: { fontSize: theme.fontSize.small, color: theme.colors.text },
  tableCellMuted: { fontSize: theme.fontSize.caption, color: theme.colors.muted },
  tableCellNumeric: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    textAlign: "right",
  },
  tableTotalRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.brand,
  },
  tableTotalLabel: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.small,
  },
  tableTotalValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    textAlign: "right",
    color: theme.colors.brand,
  },
  colItem: { flexGrow: 1, flexBasis: 0 },
  colQty: { width: 60, textAlign: "right" },
  colUnit: { width: 80, textAlign: "right" },
  colSubtotal: { width: 90, textAlign: "right" },

  // Lists
  bulletRow: {
    flexDirection: "row",
    marginBottom: theme.spacing.sm,
    alignItems: "flex-start",
  },
  bulletMark: {
    width: 14,
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSize.body,
  },
  bulletText: { flexGrow: 1, flexBasis: 0, fontSize: theme.fontSize.body, lineHeight: 1.4 },
  toneInfo: { color: theme.colors.accent },
  toneSuccess: { color: theme.colors.success },
  toneWarning: { color: theme.colors.warning },

  // Metadata / key-value blocks
  metaRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  metaKey: { width: 150, fontSize: theme.fontSize.small, color: theme.colors.muted },
  metaValue: { flexGrow: 1, flexBasis: 0, fontSize: theme.fontSize.small },

  disclaimer: {
    fontSize: theme.fontSize.caption,
    color: theme.colors.muted,
    lineHeight: 1.5,
  },
});
