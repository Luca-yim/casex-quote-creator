import { useCallback, useState } from "react";
import { createElement } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { buildAssumptions } from "@/lib/assumptions-builder";
import { calculatePricingBreakdown } from "@/lib/calculation-engine";
import { writeVersionSnapshot } from "@/lib/version-snapshot";
import {
  KEY as WBS_KEY,
  fetchQuoteCostItems,
  fetchWbsLines,
  type CostItemRow,
  type WbsLineRow,
} from "@/features/wbs/useWbsData";
import { grandTotalCost, totalImplementationFee } from "@/lib/pricing-engine/fullQuote";
import type { Assumption } from "@/lib/assumptions-builder";
import type { PricingBreakdown } from "@/types/pricing";
import type { PricingCatalogRow } from "@/types/pricing";
import type { Quote } from "@/types/quote";
import { QuotePdfDocument } from "./QuotePdfDocument";
import { quotePdfsKey } from "./useQuotePdfHistory";
import type {
  CustomerVisiblePdfData,
  InternalPdfData,
  PdfContact,
  PdfData,
  PdfQuoteConfiguration,
  PdfVersion,
} from "./types";

const UNKNOWN_CONTACT: PdfContact = { name: "Not assigned", email: "" };

/** Storage bucket holding archived quote PDFs (private). */
const PDF_BUCKET = "quote-pdfs";

/** Filename-safe ISO timestamp, e.g. `2025-01-15T10-30-00Z`. */
function isoStamp(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
}

/**
 * Uploads the generated PDF and records it in `quote_pdfs`.
 *
 * Path convention is `{quote_id}/{version}-{iso_timestamp}.pdf`; the quote id
 * MUST stay the first segment because storage RLS parses it with split_part.
 *
 * Future cleanup: PDFs accumulate indefinitely. A scheduled job could prune
 * archives older than N days for accepted/declined quotes, or keep only the
 * latest N per quote. Out of scope for MVP.
 */
async function archivePdf(
  quote: Quote,
  version: PdfVersion,
  blob: Blob,
  userId: string | null,
): Promise<void> {
  const path = `${quote.id}/${version}-${isoStamp(new Date())}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(PDF_BUCKET)
    .upload(path, blob, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (supabase as any).from("quote_pdfs").insert({
    quote_id: quote.id,
    version,
    storage_path: path,
    file_size_bytes: blob.size,
    generated_by: userId,
  });
  if (insertError) throw new Error(insertError.message);
}


/** Loads the pricing catalog exactly as `usePricingCatalog` normalizes it. */
async function fetchCatalog(): Promise<PricingCatalogRow[]> {
  const { data, error } = await supabase
    .from("pricing_catalog")
    .select("*")
    .order("sku_id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    sku_id: row.sku_id,
    name: row.name,
    category: row.category as PricingCatalogRow["category"],
    unit_price: Number(row.unit_price),
    unit_type: row.unit_type as PricingCatalogRow["unit_type"],
    tier_range: Array.isArray(row.tier_range)
      ? ([Number(row.tier_range[0]), Number(row.tier_range[1])] as [number, number])
      : null,
    effective_date: row.effective_date,
    expiration_date: row.expiration_date,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  }));
}

/** Best-effort profile lookup; falls back to the email (or a placeholder). */
async function fetchContact(userId: string | null): Promise<PdfContact> {
  if (!userId) return UNKNOWN_CONTACT;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return UNKNOWN_CONTACT;
    const email = data.email ?? "";
    return { name: data.full_name || email || "Not assigned", email };
  } catch {
    return UNKNOWN_CONTACT;
  }
}

/** Filters assumptions per version rules: customers never see warnings. */
function visibleAssumptions(quote: Quote, version: PdfVersion) {
  const all = buildAssumptions(quote);
  return version === "internal" ? all : all.filter((a) => a.tone !== "warning");
}

function fileSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "Customer";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Shared, audience-neutral fields both builders receive. */
interface SharedPdfFields {
  assumptions: Assumption[];
  configuration: PdfQuoteConfiguration;
  salesRep: PdfContact;
  estimator: PdfContact;
  generatedAt: Date;
}

/** Non-pricing scope metadata; carries no cost basis. */
function configurationOf(quote: Quote): PdfQuoteConfiguration {
  return {
    vertical: quote.vertical,
    solution: quote.solution,
    repeatableActivation: quote.repeatableActivation,
    compliance: quote.compliance,
    hostingModel: quote.hostingModel,
    supportTier: quote.supportTier,
    targetGoLiveDate: quote.targetGoLiveDate,
  };
}

/**
 * Customer-facing data. Deliberately does NOT accept WBS lines or cost items
 * as parameters, so no cost basis can reach a customer render even by mistake.
 */
function buildCustomerData(
  quote: Quote,
  breakdown: PricingBreakdown,
  shared: SharedPdfFields,
): CustomerVisiblePdfData {
  return {
    ...shared,
    version: "customer",
    quote: {
      id: quote.id,
      name: quote.name,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      tier: quote.tier,
    },
    pricing:
      quote.tier === "proposal"
        ? {
            kind: "proposal",
            totalImplementationFee: totalImplementationFee(
              quote.marginPercent,
              grandTotalCost(customerFeeInputsUnavailable(), []),
              quote.contingencyPct,
            ),
          }
        : { kind: "ballpark", breakdown },
  };
}

/** Internal data: the superset, including full cost basis. */
function buildInternalData(
  quote: Quote,
  breakdown: PricingBreakdown,
  lines: WbsLineRow[],
  items: CostItemRow[],
  shared: SharedPdfFields,
): InternalPdfData {
  if (quote.tier !== "proposal") {
    return { ...shared, version: "internal", quote, pricing: { kind: "ballpark", breakdown } };
  }
  const cost = grandTotalCost(lines, items);
  return {
    ...shared,
    version: "internal",
    quote,
    pricing: {
      kind: "proposal",
      grandTotalCost: cost,
      marginPercent: quote.marginPercent,
      contingencyPct: quote.contingencyPct,
      totalImplementationFee: totalImplementationFee(
        quote.marginPercent,
        cost,
        quote.contingencyPct,
      ),
      lines,
      items,
    },
  };
}

/**
 * Builds and downloads a customer- or internal-facing quote PDF, and records
 * the generation in the quote's audit trail.
 */
export function useQuotePdfDownload() {
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  const generatePdf = useCallback(async (quote: Quote, version: PdfVersion) => {
    setIsGenerating(true);
    try {
      let catalog: PricingCatalogRow[];
      try {
        catalog = await fetchCatalog();
      } catch (error) {
        toast.error("Could not load pricing catalog", {
          description: error instanceof Error ? error.message : undefined,
        });
        return;
      }

      const breakdown = calculatePricingBreakdown(quote, catalog);
      const assumptions = visibleAssumptions(quote, version);
      const [salesRep, estimator] = await Promise.all([
        fetchContact(quote.ownerId ?? quote.requestedBy ?? null),
        fetchContact(quote.approvedBy ?? quote.reviewedBy ?? null),
      ]);

      // WBS data is fetched only for proposal-tier quotes, and only ever
      // reaches the internal builder.
      let lines: WbsLineRow[] = [];
      let items: CostItemRow[] = [];
      if (quote.tier === "proposal") {
        try {
          [lines, items] = await Promise.all([
            queryClient.fetchQuery({
              queryKey: WBS_KEY.lines(quote.id),
              queryFn: () => fetchWbsLines(quote.id),
            }),
            queryClient.fetchQuery({
              queryKey: WBS_KEY.items(quote.id),
              queryFn: () => fetchQuoteCostItems(quote.id),
            }),
          ]);
        } catch (error) {
          toast.error("Could not load work breakdown data", {
            description: error instanceof Error ? error.message : undefined,
          });
          return;
        }
      }

      const shared = {
        assumptions,
        configuration: configurationOf(quote),
        salesRep,
        estimator,
        generatedAt: new Date(),
      };

      const context: PdfData =
        version === "internal"
          ? buildInternalData(quote, breakdown, lines, items, shared)
          : buildCustomerData(quote, breakdown, shared);

      // Loaded lazily: @react-pdf/renderer is browser-only and heavy.
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        createElement(QuotePdfDocument, { context }) as never,
      ).toBlob();

      const shortId = quote.id.slice(0, 4);
      const filename = `CaseX-Quote-${fileSafe(quote.customerName ?? "Customer")}-${shortId}-${version}.pdf`;
      // Local download fires first; archiving runs in parallel behind it.
      triggerDownload(blob, filename);

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id ?? null;

      const archiving = archivePdf(quote, version, blob, userId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: quotePdfsKey(quote.id) });
          toast.success("PDF downloaded and archived");
        })
        .catch((error: unknown) => {
          toast.warning("PDF downloaded but could not be archived to server", {
            description: error instanceof Error ? error.message : undefined,
          });
        });

      // Audit trail — never blocks the download.
      const auditing = writeVersionSnapshot({
        quoteId: quote.id,
        quoteData: quote,
        changeReason: `Generated ${version} PDF`,
        changedBy: userId,
        changeType: "pdf_generated",
      }).catch((error: unknown) => {
        console.warn("[pdf-export] audit snapshot failed", error);
      });

      await Promise.all([archiving, auditing]);
    } catch (error) {
      toast.error("PDF generation failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [queryClient]);


  return { generatePdf, isGenerating };
}
