import { formatCurrency } from "@/lib/utils";
import type { Quote, QuoteState } from "@/types/quote";

/** A quote row plus optional derived values that are not stored on the table. */
export type QuoteRowData = Quote & {
  /** Client-computed TCV, supplied by the calling view when pricing is visible. */
  totalEstimatedValue?: number | null;
};

export type QuoteColumnType =
  | "text"
  | "date"
  | "datetime"
  | "currency"
  | "state"
  | "user"
  | "boolean"
  | "number";


/** Extra context available to a column formatter (e.g. resolved profile names). */
export type QuoteColumnContext = {
  profilesMap?: Record<string, string>;
  /** Signed-in user id, used to personalise routing hints. */
  currentUserId?: string | null;
};

export interface QuoteColumn {
  /** Backend (database) field name — also the column key. */
  key: string;
  /** User-facing header label. */
  label: string;
  type: QuoteColumnType;
  sortable: boolean;
  width?: string;
  /** Reads the raw value for this column off a quote row. */
  accessor: (row: QuoteRowData) => unknown;
  /** Custom display formatter. */
  format?: (value: any, row: QuoteRowData, ctx: QuoteColumnContext) => string;
  align?: "left" | "right";
}

/* ---------------------------------------------------------------- formatting */

const DAY = 86_400_000;

/** Relative time within 7 days, absolute date otherwise. */
export function formatQuoteDateTime(
  value: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return "—";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "—";

  const diff = now.getTime() - then.getTime();
  if (diff < 0) return "just now";

  if (diff < 7 * DAY) {
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(diff / DAY);
    if (days === 1) return "yesterday";
    return `${days} days ago`;
  }

  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Absolute date, used for date-only fields. */
export function formatQuoteDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** `$X,XXX` above $100, two decimals below it. */
export function formatQuoteCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return formatCurrency(value, { decimals: Math.abs(value) > 100 ? 0 : 2 });
}

/** Resolves a user uuid to a pre-fetched display name. */
export function formatQuoteUser(
  id: string | null | undefined,
  ctx: QuoteColumnContext,
): string {
  if (!id) return "Unassigned";
  return ctx.profilesMap?.[id] ?? "Unknown user";
}

/** Friendly label + badge tone per workflow state. */
export const QUOTE_STATE_DISPLAY: Record<
  QuoteState,
  { label: string; className: string }
> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  submitted_for_review: {
    label: "Awaiting review",
    className: "bg-blue-100 text-blue-800",
  },
  under_review: {
    label: "Under review",
    className: "bg-orange-100 text-orange-800",
  },
  estimator_adjusted: {
    label: "Adjustments needed",
    className: "bg-yellow-100 text-yellow-900",
  },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  sent_to_customer: {
    label: "Sent to customer",
    className: "bg-teal-100 text-teal-800",
  },
  accepted: {
    label: "Accepted",
    className: "bg-emerald-600 font-semibold text-white",
  },
  declined: { label: "Declined", className: "bg-destructive/10 text-destructive" },
  archived: {
    label: "Archived",
    className: "bg-muted text-muted-foreground/70",
  },
};

const text = (value: unknown) => {
  const s = value === null || value === undefined ? "" : String(value);
  return s.trim() === "" ? "—" : s;
};

/* ------------------------------------------------------------- column config */

function column(col: QuoteColumn): QuoteColumn {
  return col;
}

/** Central, reusable column definitions for every quote-list view. */
export const QUOTE_COLUMNS: Record<string, QuoteColumn> = {
  id: column({
    key: "id",
    label: "Quote ID",
    type: "text",
    sortable: false,
    width: "110px",
    accessor: (r) => r.id,
    format: (v) => String(v).slice(0, 8),
  }),
  name: column({
    key: "name",
    label: "Quote name",
    type: "text",
    sortable: true,
    accessor: (r) => r.name,
    format: (v) => text(v) === "—" ? "Untitled quote" : text(v),
  }),
  state: column({
    key: "state",
    label: "Status",
    type: "state",
    sortable: true,
    width: "170px",
    accessor: (r) => r.state,
    format: (v) => QUOTE_STATE_DISPLAY[v as QuoteState]?.label ?? text(v),
  }),
  requested_by: column({
    key: "requested_by",
    label: "Requested by",
    type: "user",
    sortable: true,
    accessor: (r) => r.requestedBy,
    format: (v, _row, ctx) => formatQuoteUser(v, ctx),
  }),
  owner_id: column({
    key: "owner_id",
    label: "Assigned to",
    type: "user",
    sortable: true,
    accessor: (r) => r.ownerId,
    format: (v, _row, ctx) => formatQuoteUser(v, ctx),
  }),
  reviewed_by: column({
    key: "reviewed_by",
    label: "Reviewed by",
    type: "user",
    sortable: true,
    accessor: (r) => r.reviewedBy,
    format: (v, _row, ctx) => formatQuoteUser(v, ctx),
  }),
  approved_by: column({
    key: "approved_by",
    label: "Approved by",
    type: "user",
    sortable: true,
    accessor: (r) => r.approvedBy,
    format: (v, _row, ctx) => formatQuoteUser(v, ctx),
  }),
  submitted_at: column({

    key: "submitted_at",
    label: "Submitted",
    type: "datetime",
    sortable: true,
    accessor: (r) => r.submittedAt,
    format: (v) => formatQuoteDateTime(v),
  }),
  approved_at: column({
    key: "approved_at",
    label: "Approved",
    type: "datetime",
    sortable: true,
    accessor: (r) => r.approvedAt,
    format: (v) => formatQuoteDateTime(v),
  }),
  sent_at: column({
    key: "sent_at",
    label: "Sent to customer",
    type: "datetime",
    sortable: true,
    accessor: (r) => r.sentAt,
    format: (v) => formatQuoteDateTime(v),
  }),
  created_at: column({
    key: "created_at",
    label: "Created",
    type: "datetime",
    sortable: true,
    accessor: (r) => r.createdAt,
    format: (v) => formatQuoteDateTime(v),
  }),
  updated_at: column({
    key: "updated_at",
    label: "Last updated",
    type: "datetime",
    sortable: true,
    accessor: (r) => r.updatedAt,
    format: (v) => formatQuoteDateTime(v),
  }),
  target_go_live_date: column({
    key: "target_go_live_date",
    label: "Target go-live",
    type: "date",
    sortable: true,
    accessor: (r) => r.targetGoLiveDate,
    format: (v) => formatQuoteDate(v),
  }),
  customer_name: column({
    key: "customer_name",
    label: "Customer",
    type: "text",
    sortable: true,
    accessor: (r) => r.customerName,
    format: (v, row) => (text(v) === "—" ? row.name || "Untitled quote" : text(v)),
  }),
  customer_email: column({
    key: "customer_email",
    label: "Customer email",
    type: "text",
    sortable: true,
    accessor: (r) => r.customerEmail,
    format: (v) => text(v),
  }),
  vertical: column({
    key: "vertical",
    label: "Vertical",
    type: "text",
    sortable: true,
    accessor: (r) => r.vertical,
    format: (v) => text(v),
  }),
  solution: column({
    key: "solution",
    label: "Solution",
    type: "text",
    sortable: true,
    accessor: (r) => r.solution,
    format: (v) => text(v),
  }),
  tier: column({
    key: "tier",
    label: "Tier",
    type: "text",
    sortable: true,
    accessor: (r) => r.tier,
    format: (v) => (v === "proposal" ? "Proposal" : "Ballpark"),
  }),
  contract_years: column({
    key: "contract_years",
    label: "Years",
    type: "number",
    sortable: true,
    align: "right",
    accessor: (r) => r.contractYears,
    format: (v) => (v === null || v === undefined ? "—" : String(v)),
  }),
  margin_percent: column({
    key: "margin_percent",
    label: "Margin %",
    type: "number",
    sortable: true,
    align: "right",
    accessor: (r) => r.marginPercent,
    format: (v) => (v === null || v === undefined ? "—" : `${v}%`),
  }),
  total_estimated_value: column({
    key: "total_estimated_value",
    label: "Estimated value",
    type: "currency",
    sortable: true,
    align: "right",
    accessor: (r) => r.totalEstimatedValue ?? null,
    format: (v) => formatQuoteCurrency(v),
  }),
  has_integrations: column({
    key: "has_integrations",
    label: "Integrations",
    type: "boolean",
    sortable: true,
    accessor: (r) => r.hasIntegrations,
    format: (v) => (v ? "Yes" : "No"),
  }),
};

/** Looks up a column definition, falling back to a plain text column. */
export function getQuoteColumn(key: string): QuoteColumn {
  return (
    QUOTE_COLUMNS[key] ?? {
      key,
      label: key,
      type: "text",
      sortable: false,
      accessor: () => null,
      format: () => "—",
    }
  );
}
