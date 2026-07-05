import { useEffect, useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  loadUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications';

export interface AppNotification {
  id: string;
  order_id: string | null;
  link: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

// Module-level store: Layout mounts NotificationBell twice (desktop nav + mobile
// menu), and two same-topic realtime channels make the shared socket rejoin/drop
// mid-handshake. All bell instances share ONE channel and one list via refcount.
let userId: string | null = null;
let notifications: AppNotification[] = [];
let channel: RealtimeChannel | null = null;
let refs = 0;
const listeners = new Set<() => void>();

const setNotifications = (next: AppNotification[]) => {
  notifications = next;
  listeners.forEach((l) => l());
};

const load = async (uid: string) => {
  const { data } = await loadUserNotifications(uid);
  if (uid === userId) setNotifications((data as AppNotification[]) || []);
};

const teardown = () => {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
};

const acquire = (uid: string) => {
  if (userId !== uid) {
    teardown();
    userId = uid;
    setNotifications([]);
  }
  refs += 1;
  if (!channel) {
    load(uid);
    channel = supabase
      .channel(`user-notifications-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          setNotifications([payload.new as AppNotification, ...notifications].slice(0, 20));
        },
      )
      .subscribe();
  }
};

const release = () => {
  refs = Math.max(0, refs - 1);
  if (refs === 0) {
    teardown();
    userId = null;
    notifications = [];
  }
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useNotificationsFeed(uid: string | undefined) {
  useEffect(() => {
    if (!uid) return;
    acquire(uid);
    return release;
  }, [uid]);

  const current = useSyncExternalStore(subscribe, () => notifications);

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    if (!uid) return;
    await markAllNotificationsRead(uid);
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  return { notifications: current, markRead, markAllRead };
}
