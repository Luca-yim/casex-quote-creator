import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Shared shell for every intake section: emoji icon + title + body. */
export function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>{icon}</span> {title}
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
