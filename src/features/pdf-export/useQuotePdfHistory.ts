import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PdfVersion } from "./types";

export interface QuotePdfRecord {
  id: string;
  quote_id: string;
  version: PdfVersion;
  storage_path: string;
  file_size_bytes: number | null;
  generated_at: string;
  generated_by: string | null;
  generatorLabel: string;
}

/** Query key for the archived-PDF list of a quote. */
export const quotePdfsKey = (quoteId: string) => ["quote-pdfs", quoteId] as const;

// `quote_pdfs` is not in the generated types yet; use a loose client for it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Lists archived PDFs for a quote, newest first, with generator emails resolved. */
export function useQuotePdfHistory(quoteId: string, enabled = true) {
  return useQuery({
    queryKey: quotePdfsKey(quoteId),
    enabled: enabled && Boolean(quoteId),
    queryFn: async (): Promise<QuotePdfRecord[]> => {
      const { data, error } = await db
        .from("quote_pdfs")
        .select("*")
        .eq("quote_id", quoteId)
        .order("generated_at", { ascending: false });
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as QuotePdfRecord[];
      const ids = [...new Set(rows.map((r) => r.generated_by).filter(Boolean))] as string[];

      let profiles: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: people } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", ids);
        profiles = Object.fromEntries(
          (people ?? []).map((p) => [p.id, p.full_name || p.email || "Unknown user"]),
        );
      }

      return rows.map((row) => ({
        ...row,
        generatorLabel: (row.generated_by && profiles[row.generated_by]) || "Unknown user",
      }));
    },
  });
}

/** Creates a short-lived signed URL for an archived PDF. */
export async function createPdfSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("quote-pdfs")
    .createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create a download link");
  }
  return data.signedUrl;
}
