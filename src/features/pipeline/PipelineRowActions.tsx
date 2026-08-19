import { Copy, ExternalLink, FileDown, History, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Quote } from "@/types/quote";
import type { PdfVersion } from "@/features/pdf-export/types";

/**
 * Per-row action menu. Read-only actions only — edit and bulk operations are
 * intentionally out of scope for the pipeline view.
 */
export function PipelineRowActions({
  quote,
  onDownloadPdf,
  isDownloading,
  onViewHistory,
}: {
  quote: Quote;
  onDownloadPdf: (version: PdfVersion) => void;
  isDownloading: boolean;
  onViewHistory: (quoteId: string) => void;
}) {
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(quote.id);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy quote ID");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Row actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onClick={() => window.open(`/review/${quote.id}`, "_blank", "noopener")}
        >
          <ExternalLink className="mr-2 size-4" /> Open in new tab
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isDownloading} onClick={() => onDownloadPdf("customer")}>
          <FileDown className="mr-2 size-4" /> Download customer PDF
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isDownloading} onClick={() => onDownloadPdf("internal")}>
          <FileDown className="mr-2 size-4" /> Download internal PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onViewHistory(quote.id)}>
          <History className="mr-2 size-4" /> View version history
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyId()}>
          <Copy className="mr-2 size-4" /> Copy quote ID
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
