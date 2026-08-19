import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { NavItemLink } from "./NavItem";
import { NavMobileMenu } from "./NavMobileMenu";
import { NavUserMenu } from "./NavUserMenu";
import { activeHref, homeHrefForRole, navItemsForRole } from "./nav-config";

/**
 * Canonical navigation for every authenticated page.
 *
 * Deferred: nav badges, Cmd+K search, recent items, breadcrumbs,
 * dark-mode toggle, workspace switcher.
 */
export function NavBar({ deactivated = false }: { deactivated?: boolean }) {
  const { role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const items = deactivated ? [] : navItemsForRole(role);
  const current = activeHref(pathname, items);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-card/95 backdrop-blur transition-shadow",
        scrolled && "shadow-sm",
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-4 md:h-16">
        <NavMobileMenu deactivated={deactivated} />

        <Link
          to={homeHrefForRole(role)}
          search={role === "estimator" || role === "admin" ? undefined : undefined}
          className="flex items-center gap-2 rounded-md px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Calculator className="size-4" aria-hidden="true" />
          </span>
          <span className="font-brand text-sm font-semibold tracking-tight text-brand-navy">
            Speridian · CaseX
          </span>
        </Link>

        <nav aria-label="Main navigation" className="ml-2 hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <NavItemLink key={item.href} item={item} isActive={current === item.href} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <NavUserMenu deactivated={deactivated} />
        </div>
      </div>
    </header>
  );
}
