import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const QUEUE_STATS = [
  { label: "Awaiting review", value: "0" },
  { label: "Approved this week", value: "0" },
  { label: "Median turnaround", value: "—" },
];

export function EstimatorDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {QUEUE_STATS.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="font-mono text-3xl">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review queue 🧮</CardTitle>
          <CardDescription>
            Full pricing visibility. Adjust rates and approve quotes before they reach the customer.
          </CardDescription>
        </CardHeader>
        <CardContent className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing to review yet.
        </CardContent>
      </Card>
    </div>
  );
}
