import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { useNotificationRealtime } from "@/hooks/useNotificationRealtime";
import { NotificationRow, notificationTarget } from "@/features/notifications/notification-ui";

export function NotificationBell() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  useNotificationRealtime();

  // Pulse only when the badge goes from zero to non-zero.
  const [pulse, setPulse] = useState(false);
  const previous = useRef(unreadCount);
  useEffect(() => {
    if (previous.current === 0 && unreadCount > 0) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 1500);
      previous.current = unreadCount;
      return () => clearTimeout(t);
    }
    previous.current = unreadCount;
    return undefined;
  }, [unreadCount]);

  const handleSelect = (notification: AppNotification) => {
    if (notification.read_at === null) markAsRead(notification.id);
    setOpen(false);
    if (notification.quote_id) {
      void navigate(notificationTarget(role, notification.quote_id));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground",
                pulse && "animate-pulse",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} className="w-[min(92vw,400px)] p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllAsRead()}
              className="text-xs font-medium text-brand hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          <div className="p-1">
            {isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              notifications
                .slice(0, 20)
                .map((n) => (
                  <NotificationRow key={n.id} notification={n} onSelect={handleSelect} compact />
                ))
            )}
          </div>
        </ScrollArea>
        <Separator />
        <div className="px-3 py-2 text-center">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-brand hover:underline"
          >
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
