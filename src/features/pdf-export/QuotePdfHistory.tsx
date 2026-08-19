import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ChevronDown, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AppRole } from "@/lib/auth-types";
import type { QuoteState } from "@/types/quote";
import { canExportPdf } from "./QuotePdfDownloadButton";
import { createPdfSignedUrl, useQuotePdfHistory } from "./useQuotePdfHistory";

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Archived PDF list for a quote. Hidden entirely for external users and for
 * reps before approval; renders nothing when no PDFs exist yet.
 */
export function QuotePdfHistory({
  quoteId,
  role,
  state,
}: {
  quoteId: string;
  role: AppRole;
  state: QuoteState;
}) {
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Estimators/admins may view at any state; reps only once approved.
  const allowed =
    role === "estimator" || role === "admin"
      ? true
      : role === "sales_rep" && canExportPdf(state);

  const { data = [] } = useQuotePdfHistory(quoteId, allowed);

  if (!allowed || data.length === 0) return null;

  const download = async (id: string, path: string) => {
    setBusyId(id);
    try {
      const url = await createPdfSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error("Could not open PDF", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-muted-foreground" />
                PDF History ({data.length})
              </CardTitle>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {data.map((row) => {
              const when = new Date(row.generated_at);
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge variant={row.version === "internal" ? "destructive" : "secondary"}>
                      {row.version}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={format(when, "PPpp")}>
                        {formatDistanceToNow(when, { addSuffix: true })}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.generatorLabel} · {formatSize(row.file_size_bytes)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === row.id}
                    onClick={() => void download(row.id, row.storage_path)}
                  >
                    {busyId === row.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Download
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
