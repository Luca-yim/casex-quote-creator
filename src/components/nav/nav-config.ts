import {
  Briefcase,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  PlusCircle,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/auth-types";
import { DEFAULT_PIPELINE_SEARCH } from "@/features/pipeline/search";

/**
 * Single source of truth for the authenticated navigation.
 *
 * Deferred (not implemented yet, intentionally):
 * - nav item badges (count/dot indicators for pending actions) — `badge`
 * - quick search (Cmd+K palette)
 * - recent items dropdown
 * - breadcrumbs per route
 * - dark mode toggle
 * - multi-tenant / workspace switcher
 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: AppRole[];
  /** Reserved for future badge counts. */
  badge?: "count" | "dot" | null;
  order: number;
  /** Search params required by the target route (e.g. the pipeline filters). */
  search?: Record<string, unknown>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Admin",
    href: "/admin",
    icon: Settings,
    roles: ["admin"],
    order: 5,
  },
  {
    label: "My Requests",
    href: "/request-quote",
    icon: FileText,
    roles: ["external"],
    order: 10,
  },
  {
    label: "Dashboard",
    href: "/quotes",
    icon: LayoutDashboard,
    roles: ["sales_rep"],
    order: 10,
  },
  {
    label: "Lead Queue",
    href: "/leads",
    icon: Inbox,
    roles: ["sales_rep", "estimator", "admin"],
    order: 15,
    search: { ...DEFAULT_LEAD_SEARCH },
  },
  {
    label: "Review Queue",
    href: "/review",
    icon: ClipboardCheck,
    roles: ["estimator", "admin"],
    order: 20,
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    icon: Briefcase,
    roles: ["estimator", "admin"],
    order: 30,
    search: { ...DEFAULT_PIPELINE_SEARCH },
  },
  {
    label: "New Quote",
    href: "/quotes/new",
    icon: PlusCircle,
    roles: ["estimator", "admin"],
    order: 40,
  },
];

/** Nav items visible to a role, sorted by `order`. */
export function navItemsForRole(role: AppRole | null): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).sort((a, b) => a.order - b.order);
}

/** Landing route for the role — the logo links here. */
export function homeHrefForRole(role: AppRole | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "estimator":
      return "/review";
    case "sales_rep":
      return "/quotes";
    default:
      return "/request-quote";
  }
}

/**
 * Active-route matching: exact match, or prefix match on a path segment so
 * `/quotes/123` highlights `/quotes`. The most specific item wins, which keeps
 * `/quotes/new` from also lighting up `Dashboard`.
 */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  const matches = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? null;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  external: "External",
  sales_rep: "Sales Rep",
  estimator: "Estimator",
  admin: "Admin",
};
