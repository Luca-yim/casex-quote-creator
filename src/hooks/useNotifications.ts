import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * The `notifications` table is not part of the generated Database types yet,
 * so we talk to it through an untyped client view and validate shape here.
 */
const db = supabase as unknown as SupabaseClient;

export type NotificationType =
  | "quote_submitted"
  | "quote_approved"
  | "quote_returned"
  | "quote_sent"
  | "quote_accepted"
  | "quote_declined"
  | (string & {});

export type NotificationQuote = {
  id: string;
  name: string | null;
  customer_name: string | null;
  state: string | null;
};

export type AppNotification = {
  id: string;
  user_id: string;
  quote_id: string | null;
  type: NotificationType;
  title: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
  quote: NotificationQuote | null;
};

export const notificationsQueryKey = ["notifications"] as const;

async function fetchNotifications(userId: string, limit: number): Promise<AppNotification[]> {
  // RLS already scopes rows to the caller; the explicit filter is
  // defense-in-depth and makes the query's intent readable on its own.
  const { data, error } = await db
    .from("notifications")
    .select("*, quote:quotes(id, name, customer_name, state)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export function useNotifications({ limit = 50 }: { limit?: number } = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...notificationsQueryKey, limit],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: () => fetchNotifications(limit),
  });

  const notifications = useMemo(() => query.data ?? [], [query.data]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => n.read_at === null).length,
    [notifications],
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      const { error } = await db
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return {
    notifications,
    unreadCount,
    isLoading: query.isPending && Boolean(user?.id),
    isError: query.isError,
    error: query.error as Error | null,
    markAsRead: (id: string) => markAsRead.mutate(id),
    markAllAsRead: () => markAllAsRead.mutate(),
    isMarkingAll: markAllAsRead.isPending,
  };
}
