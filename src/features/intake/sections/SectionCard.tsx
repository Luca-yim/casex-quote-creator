import { useContext, useRef, type ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IntakeContext } from "../IntakeContext";

/** Shared shell for every intake section: emoji icon + title + body. */
export function SectionCard({
  icon,
  title,
  description,
  required = false,
  children,
}: {
  icon: string;
  title: string;
  description?: string | undefined;
  /** Marks the whole section as a required choice with a red asterisk. */
  required?: boolean;
  children: ReactNode;
}) {
  // Auto-save on section change: when focus leaves this card entirely, any
  // debounced edits are written immediately instead of waiting out the timer.
  const intake = useContext(IntakeContext);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!intake || intake.mode === "readonly") return;
    const next = event.relatedTarget as Node | null;
    if (next && cardRef.current?.contains(next)) return;
    // flushSave() is a no-op when nothing is queued, so no guard is needed —
    // and reading `hasPendingChanges` here would be a render behind the edit.
    void intake.flushSave();
  };


  return (
    <Card ref={cardRef} onBlur={handleBlur}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>{icon}</span> {title}
          {required ? (
            <span className="text-destructive" aria-hidden>
              *
            </span>
          ) : null}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}


/** Small amber callout used for compliance/hosting constraints. */
export function AmberNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
      {children}
    </p>
  );
}

/** Neutral informational callout. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
