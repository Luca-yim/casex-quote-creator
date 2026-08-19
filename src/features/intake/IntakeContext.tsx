import { createContext, useContext, type ReactNode } from "react";
import type { Quote, QuoteState } from "@/types/quote";
import type { AppRole } from "@/lib/auth";

/** Quote states in which a sales rep is allowed to see pricing. */
const SALES_REP_PRICING_STATES: QuoteState[] = [
  "approved",
  "sent_to_customer",
  "accepted",
  "declined",
];

/**
 * Determines whether the pricing details should be visible for a given
 * role and quote state.
 *
 * External users NEVER see pricing — before, during or after review.
 */
export function computeShowPricing(role: AppRole, state: QuoteState): boolean {
  if (role === "external") return false;
  if (role === "estimator" || role === "admin") return true;
  if (role === "sales_rep") return SALES_REP_PRICING_STATES.includes(state);
  return false;
}


export interface IntakeContextValue {
  quoteId: string;
  quote: Quote;
  role: AppRole;
  mode: "edit" | "readonly";
  /** True when pricing detail may be rendered for this role/state. */
  showPricing: boolean;
  /** Persist a single field change (debounced + batched auto-save). */
  updateField: (path: string, value: unknown) => void;
  /** Flush any queued auto-save writes immediately. */
  flushSave: () => Promise<void>;
  isSaving: boolean;
  lastSavedAt: Date | null;
  validationErrors: Record<string, string>;
}

export const IntakeContext = createContext<IntakeContextValue | null>(null);

export function IntakeProvider({
  value,
  children,
}: {
  value: IntakeContextValue;
  children: ReactNode;
}) {
  return (
    <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>
  );
}

/** Access the intake context. Throws when used outside `IntakeProvider`. */
export function useIntake(): IntakeContextValue {
  const ctx = useContext(IntakeContext);
  if (!ctx) {
    throw new Error("useIntake must be used within an IntakeContext.Provider");
  }
  return ctx;
}
