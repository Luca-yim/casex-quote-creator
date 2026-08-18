import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Owns the auth + profile readiness gate. Children only render once BOTH the
 * session and the profile row are loaded, so no child needs to fetch the
 * profile or raise its own "profile could not be loaded" toast.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, profileLoading, user, profile, profileMissing, profileError, signOut } = useAuth();
  const navigate = useNavigate();

  const broken = Boolean(user) && !loading && !profileLoading && (profileMissing || Boolean(profileError));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (broken) {
      toast.error("Your account setup is incomplete", {
        id: "profile-missing",
        description: "No profile record was found for this account. Please contact an administrator.",
      });
      void signOut().then(() => navigate({ to: "/login", replace: true }));
    }
  }, [loading, user, broken, navigate, signOut]);

  if (loading || (user && profileLoading)) {
    return <FullPageSpinner label="Loading your account…" />;
  }

  if (!user || broken || !profile) {
    return <FullPageSpinner label="Redirecting…" />;
  }

  return <>{children}</>;
}
