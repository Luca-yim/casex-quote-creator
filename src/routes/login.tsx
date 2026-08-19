import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, homeRouteForRole } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — CaseX Pricing Calculator" },
      { name: "description", content: "Sign in to build and review CaseXellence pricing quotes." },
      { property: "og:title", content: "Sign in — CaseX Pricing Calculator" },
      { property: "og:description", content: "Speridian sales enablement tool for CaseXellence quotes." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, role, ready, signOut } = useAuth();
  const [existingSession, setExistingSession] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setExistingSession(Boolean(data.session));
    });
  }, []);

  useEffect(() => {
    if (existingSession === false && ready && user) {
      void navigate({ to: homeRouteForRole(role), replace: true });
    }
  }, [existingSession, ready, user, role, navigate]);

  const handleContinue = () => {
    void navigate({ to: homeRouteForRole(role), replace: true });
  };

  const handleSwitchAccount = async () => {
    setSwitching(true);
    await signOut();
    setExistingSession(false);
    setSwitching(false);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back 👋");
  });

  const showNotice = existingSession === true && Boolean(user);

  return (
    <AuthShell title="Sign in" subtitle="Access the CaseX Pricing Calculator">
      {showNotice ? (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 text-sm">
            <p>
              You are signed in as{" "}
              <strong className="break-all">{user?.email}</strong>.
            </p>
          </div>
          <Button onClick={handleContinue} className="w-full" disabled={!ready}>
            {ready ? "Continue to app" : "Loading account…"}
          </Button>
          <Button
            variant="outline"
            onClick={handleSwitchAccount}
            disabled={switching}
            className="w-full"
          >
            {switching ? "Signing out…" : "Sign in as another user"}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
            <p className="text-xs text-destructive">{form.formState.errors.email?.message}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
            />
            <p className="text-xs text-destructive">{form.formState.errors.password?.message}</p>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{" "}
        <Link to="/signup" className="font-medium text-brand hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
