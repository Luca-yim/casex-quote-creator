/**
 * Design tokens for the quote PDF. Every magic value used by the PDF tree
 * lives here or in `styles.ts` so visual tweaks happen in one place.
 */
export const theme = {
  colors: {
    brand: "#001A5C",
    accent: "#003BD4",
    accentSoft: "#0075D4",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    text: "#1F2937",
    muted: "#6B7280",
    border: "#E5E7EB",
    surface: "#F8FAFC",
    background: "#FFFFFF",
    onBrand: "#FFFFFF",
  },
  fonts: {
    heading: "Helvetica-Bold",
    body: "Helvetica",
    mono: "Courier",
  },
  fontSize: {
    caption: 8,
    small: 9,
    body: 10,
    lead: 12,
    h3: 12,
    h2: 16,
    h1: 26,
    display: 34,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 22,
    xl: 34,
  },
  page: {
    padding: 40,
  },
  radius: 4,
} as const;

export type Theme = typeof theme;
