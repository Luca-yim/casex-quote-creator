import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Calculator, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, homeRouteForRole } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CaseX Pricing Calculator — Speridian Technologies" },
      {
        name: "description",
        content:
          "Internal sales enablement tool for defensible CaseXellence quotes with estimator-gated pricing approval.",
      },
      { property: "og:title", content: "CaseX Pricing Calculator — Speridian Technologies" },
      {
        property: "og:description",
        content: "Defensible CaseXellence quotes with an approval-gated pricing workflow.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, role, loading, profileLoading, ready } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || profileLoading) return;
    if (user && ready) void navigate({ to: homeRouteForRole(role), replace: true });
  }, [loading, profileLoading, ready, user, role, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
              <Calculator className="size-4" />
            </span>
            <span className="font-brand text-sm font-semibold text-brand-navy">
              Speridian · CaseX
            </span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-teal">
          CaseXellence pricing
        </p>
        <h1 className="mt-4 max-w-3xl font-brand text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
          Defensible quotes for government case management 🏛️
        </h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          A 16-question intake, an estimator approval gate, and a customer-ready quote — so pricing
          only leaves the building once Speridian stands behind it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/get-a-quote">
              Get a quote <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/signup">Create an account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/login">Team sign in</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Workflow,
              title: "One intake, three audiences",
              body: "External requesters, sales reps and estimators share the same questionnaire.",
            },
            {
              icon: ShieldCheck,
              title: "Approval-gated pricing",
              body: "Numbers stay hidden until an estimator reviews and signs off.",
            },
            {
              icon: Calculator,
              title: "Ballpark in ~5 minutes",
              body: "Fast enough for a discovery call, rigorous enough to defend.",
            },
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
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Speridian Technologies</span>
          <nav className="flex gap-4">
            <Link to="/get-a-quote" className="hover:text-brand">
              Get a quote
            </Link>
            <Link to="/login" className="hover:text-brand">
              Team sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
