import { Link } from "@tanstack/react-router";
import { FileText, Clock3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ExternalDashboard() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-brand">Request CaseXellence pricing ✨</CardTitle>
          <CardDescription>
            Answer 16 short questions about your agency and program. A Speridian estimator reviews
            every request before pricing is released.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/request-quote">Start intake</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FileText, title: "Submit intake", body: "~5 minutes, no pricing knowledge needed." },
          { icon: Clock3, title: "Estimator review", body: "Ajith's team validates scope and effort." },
          { icon: ShieldCheck, title: "Approved quote", body: "Your rep sends a customer-ready PDF." },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader className="space-y-2">
              <Icon className="size-5 text-brand" />
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your requests</CardTitle>
          <CardDescription>Submitted requests will appear here once intake is live.</CardDescription>
        </CardHeader>
        <CardContent className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No requests yet.
        </CardContent>
      </Card>
    </div>
  );
}
