import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppRole } from "@/lib/auth-types";
import type { Quote, QuoteState } from "@/types/quote";
import { useQuotePdfDownload } from "./useQuotePdfDownload";

/** Quote states from which a PDF may be exported. */
const EXPORTABLE_STATES: QuoteState[] = [
  "approved",
  "sent_to_customer",
  "accepted",
  "declined",
];

export function canExportPdf(state: QuoteState): boolean {
  return EXPORTABLE_STATES.includes(state);
}

/** Split-button PDF export. External users only get the customer version. */
export function QuotePdfDownloadButton({
  quote,
  role,
}: {
  quote: Quote;
  role: AppRole;
}) {
  const { generatePdf, isGenerating } = useQuotePdfDownload();

  if (!canExportPdf(quote.state)) return null;

  const label = isGenerating ? "Preparing…" : "Download PDF";
  const icon = isGenerating ? (
    <Loader2 className="size-4 animate-spin" />
  ) : (
    <Download className="size-4" />
  );

  if (role === "external") {
    return (
      <Button
        variant="outline"
        disabled={isGenerating}
        onClick={() => void generatePdf(quote, "customer")}
      >
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isGenerating}>
          {icon}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void generatePdf(quote, "customer")}>
          Customer version
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void generatePdf(quote, "internal")}>
          Internal version
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
