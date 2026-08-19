import { useCallback, useState } from "react";
import { createElement } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { buildAssumptions } from "@/lib/assumptions-builder";
import { calculatePricingBreakdown } from "@/lib/calculation-engine";
import { writeVersionSnapshot } from "@/lib/version-snapshot";
import type { PricingCatalogRow } from "@/types/pricing";
import type { Quote } from "@/types/quote";
import { QuotePdfDocument } from "./QuotePdfDocument";
import type { PdfContact, PdfContext, PdfVersion } from "./types";

const UNKNOWN_CONTACT: PdfContact = { name: "Not assigned", email: "" };

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

/**
 * Builds and downloads a customer- or internal-facing quote PDF, and records
 * the generation in the quote's audit trail.
 */
export function useQuotePdfDownload() {
  const [isGenerating, setIsGenerating] = useState(false);

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

      const context: PdfContext = {
        quote,
        breakdown,
        assumptions,
        salesRep,
        estimator,
        generatedAt: new Date(),
        version,
      };

      // Loaded lazily: @react-pdf/renderer is browser-only and heavy.
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        createElement(QuotePdfDocument, { context }) as never,
      ).toBlob();

      const shortId = quote.id.slice(0, 4);
      const filename = `CaseX-Quote-${fileSafe(quote.customerName ?? "Customer")}-${shortId}-${version}.pdf`;
      triggerDownload(blob, filename);
      toast.success(`${version === "internal" ? "Internal" : "Customer"} PDF downloaded`);

      // Audit trail — never blocks the download.
      try {
        const { data } = await supabase.auth.getUser();
        await writeVersionSnapshot({
          quoteId: quote.id,
          quoteData: quote,
          changeReason: `Generated ${version} PDF`,
          changedBy: data.user?.id ?? null,
          changeType: "pdf_generated",
        });
      } catch (error) {
        console.warn("[pdf-export] audit snapshot failed", error);
      }
    } catch (error) {
      toast.error("PDF generation failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generatePdf, isGenerating };
}
