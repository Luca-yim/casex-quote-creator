import { Check, CloudUpload, Loader2 } from "lucide-react";
import { useIntake } from "./IntakeContext";

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Inline auto-save indicator: saving / unsaved / last saved at.
 * Purely presentational — it reads the shared intake save state.
 */
export function SaveStatus({ className = "" }: { className?: string }) {
  const { isSaving, hasPendingChanges, lastSavedAt } = useIntake();

  const base = `flex items-center gap-1.5 text-xs text-muted-foreground ${className}`;

  if (isSaving) {
    return (
      <span className={base} role="status" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }

  if (hasPendingChanges) {
    return (
      <span className={base} role="status" aria-live="polite">
        <CloudUpload className="size-3.5" aria-hidden />
        Unsaved changes
      </span>
    );
  }

  if (lastSavedAt) {
    return (
      <span className={base} role="status" aria-live="polite">
        <Check className="size-3.5 text-emerald-600" aria-hidden />
        Saved at {formatTime(lastSavedAt)}
      </span>
    );
  }

  return (
    <span className={base} role="status" aria-live="polite">
      Changes save automatically
    </span>
  );
}
