/**
 * Service layer — Notifications domain.
 *
 * Wraps every Supabase call related to the `notifications` table used by
 * NotificationBell.  Realtime channel management stays in the component.
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch the most recent 20 notifications for a user, newest first.
 * Returns the typed Supabase result so the caller can cast as needed.
 */
export function loadUserNotifications(userId: string) {
  return supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
}

/**
 * Mark every unread notification as read for a user in one batch update.
 * Called when the user clicks "قراءة الكل".
 */
export function markAllNotificationsRead(userId: string) {
  return supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}

/**
 * Mark a single notification as read by its id.
 * Called when the user clicks an individual notification link.
 */
export function markNotificationRead(id: string) {
  return supabase.from('notifications').update({ read: true }).eq('id', id);
}
