import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth, homeRouteForRole, type AppRole } from "@/lib/auth";

export function ProtectedRoute({
  allow,
  children,
}: {
  allow: AppRole[];
  children: ReactNode;
}) {
  const { loading, user, role } = useAuth();
  const navigate = useNavigate();

  const allowed = role !== null && allow.includes(role);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (!allowed) {
      void navigate({ to: homeRouteForRole(role), replace: true });
    }
  }, [loading, user, allowed, role, navigate]);

  if (loading || !user || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
