import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { NavItemLink } from "./NavItem";
import { NavRoleBadge } from "./NavRoleBadge";
import { activeHref, navItemsForRole } from "./nav-config";

/**
 * Hamburger + slide-in menu for < 768px. Radix's Sheet supplies the focus trap,
 * Esc-to-close, and aria-modal semantics.
 */
export function NavMobileMenu({ deactivated = false }: { deactivated?: boolean }) {
  const { profile, user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Auto-close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = deactivated ? [] : navItemsForRole(role);
  const current = activeHref(pathname, items);
  const email = profile?.email ?? user?.email ?? null;
  const name = profile?.full_name?.trim() ? profile.full_name.trim() : null;
  // Collapsed trigger shows one identity only: name preferred, email as fallback.
  const identity = name ?? email ?? null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 md:hidden"
          aria-label="Open main menu"
          aria-expanded={open}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-xs p-0" aria-label="Main navigation">
        <SheetHeader className="px-4 pb-2 pt-4 text-left">
          <SheetTitle className="text-base">Speridian · CaseX</SheetTitle>
          <div className="space-y-1">
            <p className="truncate text-sm font-medium">
              {profile?.full_name ?? email ?? "Signed in"}
            </p>
            {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
            <NavRoleBadge role={role} />
          </div>
        </SheetHeader>
        <Separator />
        <nav aria-label="Main navigation" className="flex flex-col gap-1 p-2">
          {items.map((item) => (
            <NavItemLink
              key={item.href}
              item={item}
              isActive={current === item.href}
              variant="mobile"
              onNavigate={() => setOpen(false)}
            />
          ))}
        </nav>
        {deactivated ? null : (
          <>
            <Separator />
            <div className="p-2">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Bell className="size-4" aria-hidden="true" /> Notifications
              </Link>
            </div>
          </>
        )}
        <Separator />
        <div className="p-3">
          <Button
            variant="destructive"
            className="min-h-11 w-full"
            onClick={async () => {
              setOpen(false);
              await signOut();
              void navigate({ to: "/login", replace: true });
            }}
          >
            <LogOut className="mr-2 size-4" aria-hidden="true" /> Sign out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
