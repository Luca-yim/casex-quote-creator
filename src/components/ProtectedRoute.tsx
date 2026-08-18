import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { useAuth, homeRouteForRole, type AppRole } from "@/lib/auth";

function RoleGate({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
  const { role } = useAuth();
  const navigate = useNavigate();
  const allowed = role !== null && allow.includes(role);

  useEffect(() => {
    if (!allowed) void navigate({ to: homeRouteForRole(role), replace: true });
  }, [allowed, role, navigate]);

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}

export function ProtectedRoute({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
  return (
    <AuthGate>
      <RoleGate allow={allow}>{children}</RoleGate>
    </AuthGate>
  );
}
