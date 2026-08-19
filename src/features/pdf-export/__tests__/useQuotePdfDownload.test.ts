import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, TestProviders } from "@/test/test-utils";
import { makeQuote, TEST_CATALOG } from "@/lib/calculation-engine/__test-fixtures__/catalog";
import type { QueryClient } from "@tanstack/react-query";

const catalogResponse = { data: TEST_CATALOG, error: null as { message: string } | null };
const profileResponse = {
  data: { email: "rep@test.local", full_name: "Rep One" },
  error: null as { message: string } | null,
};
const uploadResponse = { error: null as { message: string } | null };
const pdfInsertResponse = { error: null as { message: string } | null };

const upload = vi.fn(async (_path: string, _blob: Blob, _opts?: unknown) => uploadResponse);
const pdfInsert = vi.fn(async (_row: Record<string, unknown>) => pdfInsertResponse);

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "pricing_catalog") {
        return { select: () => ({ order: async () => catalogResponse }) };
      }
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => profileResponse }) }),
        };
      }
      return { insert: pdfInsert };
    },
    storage: { from: () => ({ upload }) },
    auth: { getUser: async () => ({ data: { user: { id: "user-9" } } }) },
  },
}));

const writeVersionSnapshot = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("@/lib/version-snapshot", () => ({
  writeVersionSnapshot: (...a: unknown[]) => writeVersionSnapshot(...a),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}));

const toBlob = vi.fn(async () => new Blob(["%PDF-1.7"], { type: "application/pdf" }));
vi.mock("@react-pdf/renderer", () => ({ pdf: () => ({ toBlob }) }));
vi.mock("../QuotePdfDocument", () => ({ QuotePdfDocument: () => null }));

import { useQuotePdfDownload } from "../useQuotePdfDownload";

const QUOTE = makeQuote({
  id: "abcd1234-0000-0000-0000-000000000000",
  state: "approved",
  customerName: "Acme County / Health",
  ownerId: "rep-1",
});

function setup(queryClient: QueryClient = createTestQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(TestProviders, { queryClient, children });
  return { queryClient, ...renderHook(() => useQuotePdfDownload(), { wrapper }) };
}

let anchorClick: () => void;

beforeEach(() => {
  vi.clearAllMocks();
  catalogResponse.error = null;
  catalogResponse.data = TEST_CATALOG;
  uploadResponse.error = null;
  pdfInsertResponse.error = null;
  anchorClick = vi.fn() as unknown as () => void;
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick);
});

describe("generation flow", () => {
  it("starts idle", () => {
    const { result } = setup();
    expect(result.current.isGenerating).toBe(false);
  });

  it("downloads a blob through an anchor click", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(toBlob).toHaveBeenCalledTimes(1);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("resets isGenerating when finished", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "internal");
    });
    await waitFor(() => expect(result.current.isGenerating).toBe(false));
  });

  it("aborts with a toast when the catalog cannot be loaded", async () => {
    catalogResponse.error = { message: "permission denied" };
    catalogResponse.data = [];
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(toastError).toHaveBeenCalledWith(
      "Could not load pricing catalog",
      expect.objectContaining({ description: "permission denied" }),
    );
    expect(toBlob).not.toHaveBeenCalled();
  });

  it("surfaces a renderer failure as an error toast", async () => {
    toBlob.mockRejectedValueOnce(new Error("render boom"));
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(toastError).toHaveBeenCalledWith(
      "PDF generation failed",
      expect.objectContaining({ description: "render boom" }),
    );
  });
});

describe("archiving", () => {
  it("uploads to the quote-id-first storage path", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    const path = String(upload.mock.calls[0]?.[0]);
    expect(path.startsWith(`${QUOTE.id}/`)).toBe(true);
    expect(path).toMatch(/\/customer-\d{4}-\d{2}-\d{2}T[\d-]+Z\.pdf$/);
    expect(path).not.toContain(":");
  });

  it("uses the internal prefix for internal versions", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "internal");
    });
    expect(String(upload.mock.calls[0]?.[0])).toContain("/internal-");
  });

  it("records the archive row with size and generator", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(pdfInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        quote_id: QUOTE.id,
        version: "customer",
        generated_by: "user-9",
        file_size_bytes: expect.any(Number),
      }),
    );
  });

  it("confirms archiving with a success toast", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(toastSuccess).toHaveBeenCalledWith("PDF downloaded and archived");
  });

  it("warns but keeps the download when upload fails", async () => {
    uploadResponse.error = { message: "bucket denied" };
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(toastWarning).toHaveBeenCalledWith(
      "PDF downloaded but could not be archived to server",
      expect.objectContaining({ description: "bucket denied" }),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("warns when the archive row insert fails", async () => {
    pdfInsertResponse.error = { message: "rls" };
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(toastWarning).toHaveBeenCalled();
  });
});

describe("audit trail", () => {
  it("writes a pdf_generated snapshot", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "internal");
    });
    expect(writeVersionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: QUOTE.id,
        changeType: "pdf_generated",
        changeReason: "Generated internal PDF",
        changedBy: "user-9",
      }),
    );
  });

  it("does not fail the download when the snapshot write throws", async () => {
    writeVersionSnapshot.mockRejectedValueOnce(new Error("audit down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = setup();
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("invalidates the pdf history cache after archiving", async () => {
    const { result, queryClient } = setup();
    const spy = vi.spyOn(queryClient, "invalidateQueries");
    await act(async () => {
      await result.current.generatePdf(QUOTE, "customer");
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["quote-pdfs", QUOTE.id] }),
    );
  });
});
