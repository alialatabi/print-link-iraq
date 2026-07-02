import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// Native push registration. Requests permission, registers with FCM/APNs, upserts the device token
// to public.device_tokens for the signed-in user, and routes a tapped notification to its order.
// No-op on the web. Listeners are attached once per app session.
let listenersAttached = false;
// The FCM token issued to THIS device, captured from the 'registration' event so logout
// can delete its device_tokens row (stops wrong-recipient pushes on a shared phone).
let lastToken: string | null = null;

export async function registerPush(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || !userId) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return;

  if (!listenersAttached) {
    listenersAttached = true;

    // Token issued (or refreshed) → save it against the current user.
    PushNotifications.addListener('registration', async (token) => {
      lastToken = token.value;
      try {
        await supabase.from('device_tokens' as never).upsert(
          { user_id: userId, token: token.value, platform: Capacitor.getPlatform() } as never,
          { onConflict: 'token' },
        );
      } catch (e) {
        console.error('device token upsert failed', e);
      }
    });

    PushNotifications.addListener('registrationError', (err) => console.error('push registration error', err));

    // Tapping a notification → deep-link to the order it's about.
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const orderId = action.notification?.data?.orderId;
      if (orderId) window.location.assign(`/track-order/${orderId}`);
    });
  }

  await PushNotifications.register();
}

/** Remove this device's token on logout so the user stops receiving pushes here. */
export async function unregisterPush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    // Delete THIS device's token row so the signed-out user stops receiving order pushes
    // here — critical on a shared phone where the next person signs in.
    if (lastToken) {
      await supabase.from('device_tokens' as never).delete().eq('token', lastToken);
      lastToken = null;
    }
    await PushNotifications.removeAllDeliveredNotifications();
    // Detach listeners so the NEXT sign-in re-registers against the new user id (the
    // 'registration' handler closes over the user id captured at attach time).
    await PushNotifications.removeAllListeners();
    listenersAttached = false;
  } catch { /* ignore */ }
}
