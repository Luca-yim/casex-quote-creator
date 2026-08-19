import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { NavItem as NavItemConfig } from "./nav-config";

/** A single nav link. Active state uses a primary-colored underline. */
export function NavItemLink({
  item,
  isActive,
  variant = "desktop",
  onNavigate,
}: {
  item: NavItemConfig;
  isActive: boolean;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      to={item.href}
      search={item.search as never}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "desktop"
          ? "relative px-2.5 py-2 hover:bg-muted"
          : "min-h-11 w-full px-3 py-2.5 hover:bg-muted",
        isActive ? "text-brand" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
      {isActive && variant === "desktop" ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-brand"
        />
      ) : null}
    </Link>
  );
}
