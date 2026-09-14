import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, Calculator, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, homeRouteForRole } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CaseX Pricing Calculator — Speridian Technologies" },
      {
        name: "description",
        content:
          "Request a CaseXellence quote in minutes — no account needed. Every quote is reviewed and approved by an estimator before pricing goes out.",
      },
      { property: "og:title", content: "CaseX Pricing Calculator — Speridian Technologies" },
      {
        property: "og:description",
        content:
          "Request a quote in minutes, no account needed — reviewed and approved by an estimator before pricing goes out.",
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
            <BrandLogo className="size-8" />
            <span className="font-brand text-sm font-semibold text-brand-navy">Speridian · CaseX</span>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-teal">CaseXellence pricing</p>
        <h1 className="mt-4 max-w-3xl font-brand text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
          Defensible quotes for case management
        </h1>
        <p className="mt-5 max-w-2xl text-muted-foreground">
          Request a quote in minutes — no account needed. Verify with a quick check, answer a short guided
          questionnaire, and get a reference number your team can track. Every quote is submitted for approval and
          signed off by an estimator before pricing goes out the door.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/get-a-quote">
              Get a quote <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: ShieldCheck,
              title: "No sign-up required",
              body: "Anyone can request a quote anonymously — a quick one-time check, then a short guided flow. No password, no account.",
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
        <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-8 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Speridian Technologies</span>
        </div>
      </footer>
    </div>
  );
}
