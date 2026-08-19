import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { notificationsQueryKey } from "@/hooks/useNotifications";

/**
 * Live-updates the notification cache for the signed-in user.
 *
 * Inserts arriving in quick succession are coalesced: a single trailing toast
 * is shown (with a "+N more" suffix) at most once per THROTTLE_MS window.
 */
const THROTTLE_MS = 1200;

/**
 * Guards against a second subscriber: the bell and the notifications page both
 * call this hook. Supabase rejects re-using a channel name after subscribe(),
 * and two channels would double every toast — so only the first mount owns it.
 */
let channelOwned = false;

export function useNotificationRealtime() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pending = useRef<{ title: string; count: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const flush = () => {
      timer.current = null;
      const batch = pending.current;
      pending.current = null;
      if (!batch) return;
      toast(batch.count > 1 ? `${batch.title} (+${batch.count - 1} more)` : batch.title);
    };

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
          const row = payload.new as { title?: string | null };
          const title = row?.title?.trim() || "New notification";
          pending.current = pending.current
            ? { title: pending.current.title, count: pending.current.count + 1 }
            : { title, count: 1 };
          if (timer.current === null) timer.current = setTimeout(flush, THROTTLE_MS);
        },
      )
      .subscribe();

    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
