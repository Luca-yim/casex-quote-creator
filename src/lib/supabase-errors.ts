import { STATE_LABELS } from "@/lib/quote-workflow";
import type { QuoteState } from "@/types/quote";

/** Postgres error code raised when a row-level security policy rejects a write. */
export const RLS_VIOLATION = "42501";

/** Postgres error code raised when a CHECK constraint / state-machine guard rejects a write. */
export const CHECK_VIOLATION = "23514";

type MaybePostgrestError = {
  code?: string;
  message?: string;
};

/** True when the error came back from a row-level security policy rejection. */
export function isPermissionError(error: unknown): boolean {
  const err = error as MaybePostgrestError | null;
  if (!err) return false;
  if (err.code === RLS_VIOLATION) return true;
  return typeof err.message === "string" && /row-level security policy/i.test(err.message);
}

/**
 * Turns a raw Supabase/Postgres error into a message a sales user can act on.
 * Security-policy rejections are the common case: the account is signed in but
 * the backend does not allow that particular write.
 */
export function describeQuoteWriteError(error: unknown, nextState?: QuoteState): string {
  if (isPermissionError(error)) {
    const target = nextState ? ` to “${STATE_LABELS[nextState]}”` : "";
    return (
      `Your account isn't allowed to move this quote${target}. ` +
      "The workspace security policy needs to permit this step — ask an administrator to update it."
    );
  }
  const guard = error as MaybePostgrestError | null;
  if (guard?.code === CHECK_VIOLATION || /invalid state transition/i.test(guard?.message ?? "")) {
    if (nextState === "approved") {
      return (
        "This quote can't be approved yet — it was returned for edit. " +
        "The sales rep must resubmit it, and it needs to be claimed for review again before approval."
      );
    }
    const target = nextState ? ` to “${STATE_LABELS[nextState]}”` : "";
    return (
      `The backend's quote state-machine guard doesn't allow this step${target} yet. ` +
      "An administrator needs to add it to the allowed-transition list."
    );
  }
  if (error instanceof Error) return error.message;
  const err = error as MaybePostgrestError | null;
  return err?.message ?? "Please try again.";
}
