import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/request-quote/confirmation/$id")({
  head: () => ({
    meta: [
      { title: "Request submitted — CaseX Pricing Calculator" },
      { name: "description", content: "Your CaseXellence pricing request was submitted for review." },
      { property: "og:title", content: "Request submitted — CaseX Pricing Calculator" },
      { property: "og:description", content: "Your pricing request is now with a Speridian estimator." },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { id } = Route.useParams();
  return (
    <ProtectedRoute allow={["external", "sales_rep", "estimator", "admin"]}>
      <AppLayout title="Request submitted" description="An estimator will review your intake">
        <Card className="max-w-xl">
          <CardHeader className="space-y-2">
            <CheckCircle2 className="size-6 text-brand-teal" />
            <CardTitle className="font-brand">Thanks — we've got it ✅</CardTitle>
            <CardDescription>
              Reference <span className="font-mono">{id}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Your intake is queued for estimator review. Pricing is released only after approval.
            </p>
            <Button asChild variant="outline">
              <Link to="/request-quote">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    </ProtectedRoute>
  );
}
