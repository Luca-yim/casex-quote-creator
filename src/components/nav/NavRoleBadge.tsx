import type { AppRole } from "@/lib/auth-types";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "./nav-config";

/** Color-coded, role-specific pill. Amber signals elevated (admin) privilege. */
const ROLE_CLASS: Record<AppRole, string> = {
  external: "bg-muted text-muted-foreground border-border",
  sales_rep: "bg-brand/10 text-brand border-brand/30",
  estimator: "bg-secondary text-secondary-foreground border-border",
  admin: "bg-amber-100 text-amber-900 border-amber-300",
};

export function NavRoleBadge({ role, className }: { role: AppRole | null; className?: string }) {
  if (!role) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        ROLE_CLASS[role],
        className,
      )}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
