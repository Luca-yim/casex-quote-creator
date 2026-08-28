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
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { isTurnstileEnabled } from "@/lib/turnstile";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account — CaseX Pricing Calculator" },
      { name: "description", content: "Create an account to request CaseXellence pricing." },
      { property: "og:title", content: "Create account — CaseX Pricing Calculator" },
      { property: "og:description", content: "Request defensible CaseXellence pricing from Speridian." },
    ],
  }),
  component: SignupPage,
});

const schema = z.object({
  fullName: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(12, "At least 12 characters"),
});

function SignupPage() {
  const navigate = useNavigate();
  const { user, role, loading, profileLoading, ready } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  // Supabase Auth enforces CAPTCHA on signup as well; tokens are single-use.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  useEffect(() => {
    if (loading || profileLoading) return;
    if (user && ready) void navigate({ to: homeRouteForRole(role), replace: true });
  }, [loading, profileLoading, ready, user, role, navigate]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: values.fullName },
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    setSubmitting(false);
    if (error) {
      setCaptchaToken(null);
      setCaptchaKey((k) => k + 1);
      toast.error(error.message);
      return;
    }
    toast.success("Account created 🎉");
  });

  return (
    <AuthShell title="Create account" subtitle="Request pricing for CaseXellence">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" {...form.register("fullName")} />
          <p className="text-xs text-destructive">{form.formState.errors.fullName?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          <p className="text-xs text-destructive">{form.formState.errors.email?.message}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
          <p className="text-xs text-destructive">{form.formState.errors.password?.message}</p>
        </div>
        {isTurnstileEnabled && (
          <TurnstileWidget
            key={captchaKey}
            onToken={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
          />
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || (isTurnstileEnabled && !captchaToken)}
        >
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
