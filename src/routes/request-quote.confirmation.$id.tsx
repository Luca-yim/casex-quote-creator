import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuoteById } from "@/features/intake/useQuote";

export const Route = createFileRoute("/request-quote/confirmation/$id")({
  head: () => ({
    meta: [
      { title: "Request received — CaseX Pricing Calculator" },
      { name: "description", content: "Your CaseXellence pricing request was submitted for review." },
      { property: "og:title", content: "Request received — CaseX Pricing Calculator" },
      { property: "og:description", content: "Your pricing request is now with a Speridian estimator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { id } = Route.useParams();
  const { data: quote } = useQuoteById(id);
  const contact = quote?.customerEmail ?? "the email on your request";

  return (
    <ProtectedRoute allow={["external", "sales_rep", "estimator", "admin"]}>
      <AppLayout title="Request received" description="An estimator will review your intake">
        <div className="flex justify-center py-6">
          <Card className="w-full max-w-xl text-center">
            <CardHeader className="items-center space-y-3">
              <CheckCircle2 className="size-12 text-emerald-600" aria-hidden="true" />
              <CardTitle className="font-brand text-2xl">Request received</CardTitle>
              <CardDescription>
                Reference: <span className="font-mono">{id}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Our team will contact you at{" "}
                <span className="font-medium text-foreground">{contact}</span> within 2 business
                days with your ballpark estimate.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/request-quote/$id" params={{ id }}>
                    View quote details
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/request-quote">Return to dashboard</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/get-a-quote">
                    Submit another
                  </Link>
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
