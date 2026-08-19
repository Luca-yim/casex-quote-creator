import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { useNotificationRealtime } from "@/hooks/useNotificationRealtime";
import { NotificationRow, notificationTarget } from "@/features/notifications/notification-ui";

const PAGE_SIZE = 25;

export function NotificationsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, isMarkingAll } =
    useNotifications();
  useNotificationRealtime();

  const filtered = useMemo(
    () => (tab === "unread" ? notifications.filter((n) => n.read_at === null) : notifications),
    [notifications, tab],
  );
  const rows = filtered.slice(0, visible);

  const handleSelect = (notification: AppNotification) => {
    if (notification.read_at === null) markAsRead(notification.id);
    if (notification.quote_id) {
      void navigate(notificationTarget(role, notification.quote_id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as "all" | "unread");
            setVisible(PAGE_SIZE);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || isMarkingAll}
          onClick={() => markAllAsRead()}
        >
          Mark all read
        </Button>
      </div>

      <Card className="p-2">
        {isLoading ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            {tab === "unread" ? "No unread notifications" : "No notifications yet"}
          </p>
        ) : (
          <div className="divide-y">
            {rows.map((n) => (
              <NotificationRow key={n.id} notification={n} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </Card>

      {filtered.length > rows.length ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
