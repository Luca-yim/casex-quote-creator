import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQuoteVersions } from "./useQuoteVersions";
import type { VersionChangeType } from "@/lib/version-snapshot";

const TYPE_VARIANT: Record<VersionChangeType, "default" | "secondary" | "outline" | "destructive"> =
  {
    submit: "secondary",
    claim: "outline",
    adjust: "secondary",
    approve: "default",
    return: "destructive",
    send: "default",
    accept: "default",
    decline: "destructive",
    pdf_generated: "outline",
    promote: "default",
  };

/**
 * Slide-in audit trail of every stored snapshot for a quote.
 *
 * Uncontrolled by default (renders its own trigger button). Pass `open` and
 * `onOpenChange` to drive it from elsewhere, e.g. the pipeline row menu.
 */
export function VersionHistorySheet({
  quoteId,
  open: controlledOpen,
  onOpenChange,
}: {
  quoteId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [expanded, setExpanded] = useState<string | null>(null);
  const versions = useQuoteVersions(quoteId, open);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {isControlled ? null : (
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <History className="mr-1 size-4" /> Version history
          </Button>
        </SheetTrigger>
      )}

      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>Every recorded change to this quote, newest first.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {versions.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : versions.isError ? (
            <p className="text-sm text-destructive">
              {versions.error instanceof Error
                ? versions.error.message
                : "Version history could not be loaded."}
            </p>
          ) : (versions.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions recorded yet.</p>
          ) : (
            versions.data!.map((version) => (
              <div key={version.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium">v{version.versionNumber}</span>
                  {version.changeType ? (
                    <Badge variant={TYPE_VARIANT[version.changeType]}>{version.changeType}</Badge>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(version.changedAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-2 text-sm">{version.changeReason ?? "No reason recorded"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{version.authorLabel}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 px-0"
                  onClick={() => setExpanded(expanded === version.id ? null : version.id)}
                >
                  {expanded === version.id ? "Hide snapshot" : "View snapshot"}
                </Button>
                {expanded === version.id ? (
                  <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                    {JSON.stringify(version.snapshot, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
