import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { NavRoleBadge } from "./NavRoleBadge";

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}

/** Avatar trigger + dropdown with identity, role badge, and sign out. */
export function NavUserMenu({ deactivated = false }: { deactivated?: boolean }) {
  const { profile, user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const name = profile?.full_name?.trim() ? profile.full_name.trim() : null;
  const email = profile?.email ?? user?.email ?? null;
  // Collapsed trigger shows one identity only: name preferred, email as fallback.
  const identity = name ?? email ?? null;

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login", replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 gap-1.5 px-1.5 sm:px-2"
          aria-label="User menu"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {initials(name, email)}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="space-y-1 px-2 py-2">
          <p className="truncate text-sm font-semibold">{name ?? email ?? "Signed in"}</p>
          {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
          <NavRoleBadge role={role} />
        </div>
        {deactivated ? null : (
          <>
            <DropdownMenuSeparator />
            {/* "Profile" omitted: no /profile route exists yet. */}
            <DropdownMenuItem asChild>
              <Link to="/notifications">
                <Bell className="mr-2 size-4" aria-hidden="true" /> Notifications
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" aria-hidden="true" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
