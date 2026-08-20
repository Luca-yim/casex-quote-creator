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
        data: { full_name: values.fullName, company: values.company },
      },
    });
    setSubmitting(false);
    if (error) {
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
          <Label htmlFor="company">Organization</Label>
          <Input id="company" {...form.register("company")} />
          <p className="text-xs text-destructive">{form.formState.errors.company?.message}</p>
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
        <Button type="submit" className="w-full" disabled={submitting}>
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
