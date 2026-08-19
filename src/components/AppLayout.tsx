import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { NavBar } from "@/components/nav/NavBar";
import { useAuth } from "@/lib/auth";

/**
 * Shared shell for every authenticated page: canonical <NavBar /> on top,
 * route-specific page header and content below. Login/signup use AuthShell.
 */
export function AppLayout({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  // `deactivated_at` is optional in the profile row; treat its presence as a lockout.
  const deactivated = Boolean(
    (profile as { deactivated_at?: string | null } | null)?.deactivated_at,
  );

  return (
    <div className="min-h-dvh bg-muted/40">
      {deactivated ? (
        <div
          role="alert"
          className="flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          Your account has been deactivated. Please contact your admin.
        </div>
      ) : null}

      <NavBar deactivated={deactivated} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {deactivated ? (
          <p className="text-sm text-muted-foreground">
            Access is disabled while your account is deactivated. Sign out from the user menu.
          </p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </div>
            {children}
          </>
        )}
      </main>
    </div>
  );
}
