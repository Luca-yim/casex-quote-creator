import type { AppRole } from "@/lib/auth";
import type { QuoteState } from "@/types/quote";

/**
 * Collaborative pipeline:
 *
 *   external / sales rep  ->  submit intake (no pricing)
 *   estimator             ->  review, adjust, approve or return
 *   sales rep             ->  send approved quote to the customer
 */

export type QuoteAction =
  | "submit_for_review"
  | "start_review"
  | "mark_adjusted"
  | "approve"
  | "return_to_sales"
  | "send_to_customer"
  | "mark_accepted"
  | "mark_declined";

export interface WorkflowAction {
  action: QuoteAction;
  label: string;
  /** Resulting workflow state. */
  next: QuoteState;
  variant: "default" | "outline" | "secondary" | "destructive";
  description: string;
}

const ACTIONS: Record<QuoteAction, Omit<WorkflowAction, "action">> = {
  submit_for_review: {
    label: "Submit for review",
    next: "submitted_for_review",
    variant: "default",
    description: "Sends the intake to the estimator queue.",
  },
  start_review: {
    label: "Start review",
    next: "under_review",
    variant: "default",
    description: "Claims this quote for estimator review.",
  },
  mark_adjusted: {
    label: "Save adjustments",
    next: "estimator_adjusted",
    variant: "secondary",
    description: "Records that estimator adjustments were made.",
  },
  approve: {
    label: "Approve pricing",
    next: "approved",
    variant: "default",
    description: "Releases pricing back to the sales rep.",
  },
  return_to_sales: {
    label: "Return for edit",
    next: "estimator_adjusted",
    variant: "outline",
    description: "Assigns the quote to a sales rep for revision.",
  },
  send_to_customer: {
    label: "Send to customer",
    next: "sent_to_customer",
    variant: "default",
    description: "Marks the approved quote as delivered to the customer.",
  },
  mark_accepted: {
    label: "Mark accepted",
    next: "accepted",
    variant: "default",
    description: "The customer accepted this quote.",
  },
  mark_declined: {
    label: "Mark declined",
    next: "declined",
    variant: "outline",
    description: "The customer declined this quote.",
  },
};

/** Human-readable label for a workflow state. */
export const STATE_LABELS: Record<QuoteState, string> = {
  draft: "Draft",
  submitted_for_review: "Submitted for review",
  under_review: "Under estimator review",
  estimator_adjusted: "Estimator adjusted",
  approved: "Approved",
  sent_to_customer: "Sent to customer",
  accepted: "Accepted",
  declined: "Declined",
  archived: "Archived",
};

/** Short explanation of who owns the quote right now. */
export function stageOwner(state: QuoteState): string {
  switch (state) {
    case "draft":
      return "With the requester — complete the intake and submit.";
    case "submitted_for_review":
    case "under_review":
      return "With the estimator — pricing is being reviewed.";
    case "estimator_adjusted":
      return "Returned for edit — with the assigned sales rep.";
    case "approved":
      return "Back with the sales rep — approved pricing is available.";
    case "sent_to_customer":
      return "With the customer — awaiting their decision.";
    case "accepted":
      return "Closed won.";
    case "declined":
      return "Closed lost.";
    default:
      return "Archived.";
  }
}

/** Actions the given role may take from the given state. */
export function availableActions(
  role: AppRole,
  state: QuoteState,
): WorkflowAction[] {
  const keys: QuoteAction[] = [];

  if (
    role === "external" ||
    role === "sales_rep" ||
    role === "admin" ||
    role === "estimator"
  ) {
    if (state === "draft") keys.push("submit_for_review");
  }

  if (role === "estimator" || role === "admin") {
    if (state === "submitted_for_review") keys.push("start_review");
    if (state === "under_review") keys.push("mark_adjusted");
    if (state === "under_review" || state === "estimator_adjusted") {
      keys.push("approve", "return_to_sales");
    }
  }

  if (role === "sales_rep" || role === "admin") {
    if (state === "approved") keys.push("send_to_customer");
    if (state === "sent_to_customer") keys.push("mark_accepted", "mark_declined");
  }

  return keys.map((action) => ({ action, ...ACTIONS[action] }));
}

/** Whether the intake fields are editable for this role at this stage. */
export function canEditIntake(role: AppRole, state: QuoteState): boolean {
  if (role === "admin") return true;
  if (role === "external" || role === "sales_rep") {
    return state === "draft" || state === "estimator_adjusted";
  }
  if (role === "estimator") {
    return (
      // Estimators author their own drafts, same as reps.
      state === "draft" ||
      state === "submitted_for_review" ||
      state === "under_review" ||
      state === "estimator_adjusted"
    );
  }
  return false;
}

/**
 * Whether this specific user may edit the intake right now.
 *
 * Adds ownership on top of the role/state rule: a returned quote
 * (`estimator_adjusted`) is editable only by the rep it was assigned to.
 */
export function canEditQuote(
  role: AppRole,
  state: QuoteState,
  ownerId: string | null,
  userId: string | null | undefined,
): boolean {
  if (!canEditIntake(role, state)) return false;
  // An estimator may only edit a draft they own (their own authored quote).
  if (state === "draft" && role === "estimator") {
    return Boolean(userId) && ownerId === userId;
  }
  if (state !== "estimator_adjusted") return true;
  if (role === "admin" || role === "estimator") return true;
  return Boolean(userId) && ownerId === userId;
}

/**
 * Simplified state wording for external requesters. Internal rework
 * (returns, estimator adjustments, internal approval) all read as "in review"
 * until the quote is actually delivered to them.
 */
export function externalStateLabel(state: QuoteState): string {
  switch (state) {
    case "draft":
      return "Draft";
    case "submitted_for_review":
      return "Awaiting review";
    case "under_review":
    case "estimator_adjusted":
    case "approved":
      return "In review";
    case "sent_to_customer":
      return "Ready — quote available";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Not proceeding";
    default:
      return "Archived";
  }
}
