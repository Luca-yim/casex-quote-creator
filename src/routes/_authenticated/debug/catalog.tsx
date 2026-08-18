import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePricingCatalog } from "@/hooks/usePricingCatalog";
import { useVerticalSolutions } from "@/hooks/useVerticalSolutions";
import { formatCurrency, formatNumber } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/debug/catalog")({
  head: () => ({
    meta: [
      { title: "Debug Catalog — CaseX Pricing Calculator" },
      {
        name: "description",
        content: "Internal debug view for pricing catalog and vertical solutions.",
      },
      { property: "og:title", content: "Debug Catalog — CaseX Pricing Calculator" },
      {
        property: "og:description",
        content: "Internal debug view for pricing catalog and vertical solutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DebugCatalogPage,
});

function DebugCatalogPage() {
  const catalogQuery = usePricingCatalog();
  const verticalsQuery = useVerticalSolutions();

  const catalogRows = catalogQuery.data ?? [];
  const verticalRows = verticalsQuery.data ?? [];

  const isLoading = catalogQuery.isLoading || verticalsQuery.isLoading;
  const error = catalogQuery.error ?? verticalsQuery.error ?? null;

  return (
    <AppLayout
      title="Debug Catalog"
      description="Verify Supabase RLS and seed data for pricing catalog + verticals."
    >
      <div className="space-y-8">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Data load failed</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading catalog and verticals…</span>
          </div>
        ) : null}

        {!isLoading ? (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Pricing Catalog
                </h2>
                <span className="text-xs text-muted-foreground">
                  {catalogRows.length} row{catalogRows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead>Unit Type</TableHead>
                      <TableHead>Tier Range</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {catalogRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No catalog rows returned. Check RLS / seed data.
                        </TableCell>
                      </TableRow>
                    ) : (
                      catalogRows.map((row) => (
                        <TableRow key={row.sku_id}>
                          <TableCell className="font-mono text-xs">
                            {row.sku_id}
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize">
                              {row.category.replace("_", " ")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatCurrency(row.unit_price)}
                          </TableCell>
                          <TableCell className="text-xs capitalize">
                            {row.unit_type.replace("_", " ")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.tier_range
                              ? `${formatNumber(row.tier_range[0])} – ${formatNumber(
                                  row.tier_range[1],
                                )}`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      )))
                    }
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Vertical Solutions
                </h2>
                <span className="text-xs text-muted-foreground">
                  {verticalRows.length} row{verticalRows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vertical L1</TableHead>
                      <TableHead>Solution L2</TableHead>
                      <TableHead>Display Label</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verticalRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No vertical solutions returned. Check RLS / seed data.
                        </TableCell>
                      </TableRow>
                    ) : (
                      verticalRows.map((row) => (
                        <TableRow key={`${row.vertical_l1}-${row.solution_l2}`}>
                          <TableCell>{row.vertical_l1}</TableCell>
                          <TableCell>{row.solution_l2}</TableCell>
                          <TableCell className="font-medium">
                            {row.display_label}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
