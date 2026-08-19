import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/hooks/useNotifications";
import type { AppRole } from "@/lib/auth-types";

const DOT_CLASS: Record<string, string> = {
  quote_submitted: "bg-blue-500",
  quote_approved: "bg-emerald-500",
  quote_returned: "bg-amber-500",
  quote_sent: "bg-purple-500",
  quote_accepted: "bg-emerald-500",
  quote_declined: "bg-muted-foreground",
};

export function dotClassForType(type: NotificationType) {
  return DOT_CLASS[type] ?? "bg-muted-foreground";
}

/** "2m ago" style relative time. */
export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Destination for a notification row, based on the viewer's role. */
export function notificationTarget(role: AppRole | null, quoteId: string) {
  if (role === "estimator" || role === "admin") {
    return { to: "/review/$id" as const, params: { id: quoteId } };
  }
  if (role === "sales_rep") {
    return { to: "/quotes/$id" as const, params: { id: quoteId } };
  }
  return { to: "/request-quote/$id" as const, params: { id: quoteId } };
}

export function NotificationRow({
  notification,
  onSelect,
  compact = false,
}: {
  notification: AppNotification;
  onSelect: (notification: AppNotification) => void;
  compact?: boolean;
}) {
  const unread = notification.read_at === null;
  const body = notification.body ?? notification.quote?.name ?? "";

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "py-2.5" : "py-3",
        unread && "bg-muted/40",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          unread ? dotClassForType(notification.type) : "bg-transparent ring-1 ring-border",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}
            title={notification.title ?? undefined}
          >
            {notification.title ?? "Notification"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {relativeTime(notification.created_at)}
          </span>
        </span>
        {body ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={body}>
            {body}
          </span>
        ) : null}
      </span>
    </button>
  );
}
