import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyQuotesTable } from "@/features/quotes/MyQuotesTable";
import { useMyQuotes, type MyQuotesTab } from "@/features/quotes/useMyQuotes";

type Props = {
  tab: MyQuotesTab;
  onTabChange: (tab: MyQuotesTab) => void;
};

/**
 * External user landing page: their quotes are the only destination that
 * matters, so the dashboard is the My Quotes view itself.
 */
export function ExternalDashboard({ tab, onTabChange }: Props) {
  const query = useMyQuotes(tab);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button asChild>
          <Link to="/request-quote" search={{ start: true }}>
            <Plus className="size-4" aria-hidden="true" />
            New Quote
          </Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(next) => onTabChange(next as MyQuotesTab)}>
        <TabsList>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <MyQuotesTable
            tab={tab}
            quotes={query.data ?? []}
            isPending={query.isPending}
            isError={query.isError}
            error={query.error}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
