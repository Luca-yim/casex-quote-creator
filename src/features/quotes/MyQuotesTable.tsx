import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { STATE_LABELS } from "@/lib/quote-workflow";
import { readinessCheck } from "@/lib/quote-validation";
import { DeleteDraftButton } from "@/features/quotes/DeleteDraftButton";
import type { Quote } from "@/types/quote";
import type { MyQuotesTab } from "./useMyQuotes";

function relative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m ago`;
}

function absolute(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "Unknown";
}

type Props = {
  tab: MyQuotesTab;
  quotes: Quote[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
};

export function MyQuotesTable({ tab, quotes, isPending, isError, error }: Props) {
  const navigate = useNavigate();

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Could not load your quotes: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
        {tab === "submitted" ? (
          "You haven't submitted any quotes yet."
        ) : (
          <span>
            You have no saved drafts.{" "}
            <button
              type="button"
              className="font-medium text-brand underline underline-offset-4"
              onClick={() => void navigate({ to: "/request-quote", search: { start: true } })}
            >
              Start a new quote
            </button>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Quote name</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">
              {tab === "submitted" ? "Created" : "Last modified"}
            </th>
            <th className="px-4 py-3 font-medium">{tab === "submitted" ? "State" : "Progress"}</th>
            {tab === "drafts" ? <th className="w-12 px-4 py-3" /> : null}
          </tr>
        </thead>
        <tbody className="divide-y">
          {quotes.map((quote) => {
            const open = () =>
              void navigate({ to: "/request-quote/$id", params: { id: quote.id } });
            const readiness = readinessCheck(quote);
            const pct = Math.round((readiness.completedCount / readiness.totalRequired) * 100);

            return (
              <tr
                key={quote.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${quote.name || "Untitled quote"}`}
                onClick={open}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    open();
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
              >
                <td className="px-4 py-3 font-medium">{quote.name || "Untitled quote"}</td>
                <td className="px-4 py-3 text-muted-foreground">{quote.customerName || "—"}</td>
                <td
                  className="px-4 py-3 text-muted-foreground"
                  title={absolute(tab === "submitted" ? quote.createdAt : quote.updatedAt)}
                >
                  {relative(tab === "submitted" ? quote.createdAt : quote.updatedAt)}
                </td>
                <td className="px-4 py-3">
                  {tab === "submitted" ? (
                    <Badge variant="secondary">{STATE_LABELS[quote.state]}</Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-2 w-24" />
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  )}
                </td>
                {tab === "drafts" ? (
                  <td className="px-4 py-3 text-right">
                    <DeleteDraftButton quote={quote} />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
