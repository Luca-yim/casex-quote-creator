import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STAGES = [
  { label: "Draft", count: 0, hint: "Intake started, not submitted" },
  { label: "In review", count: 0, hint: "With the estimator queue" },
  { label: "Approved", count: 0, hint: "Ready to send to the customer" },
];

export function SalesRepDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {STAGES.map((stage) => (
          <Card key={stage.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stage.label}</CardDescription>
              <CardTitle className="font-mono text-3xl">{stage.count}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{stage.hint}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Quotes 📋</CardTitle>
            <CardDescription>Pricing stays hidden until an estimator approves.</CardDescription>
          </div>
          <Button asChild size="sm">
            <Link to="/quotes/new">
              <Plus className="mr-1 size-4" /> New quote
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          No quotes yet — the intake questionnaire lands here next.
        </CardContent>
      </Card>
    </div>
  );
}
