import { useEffect, useState } from 'react';
import { isNativeApp } from '@/lib/platform';

/**
 * Tracks whether the device currently has an internet connection.
 *
 * Web: `navigator.onLine` seed + the window `online` / `offline` events.
 * Native (Capacitor): ALSO subscribes to `@capacitor/network`, whose `networkStatusChange`
 * event is more reliable than the WebView's navigator events on Android. The plugin is pulled
 * in via dynamic import so it never lands in the web bundle (same pattern as src/lib/push.ts).
 *
 * Returns `true` when online, `false` when offline.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = (): void => setOnline(true);
    const handleOffline = (): void => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // The dynamic import may resolve after unmount; guard so we don't leak a native listener
    // or set state on an unmounted hook.
    let cancelled = false;
    let removeNativeListener: (() => void) | undefined;

    if (isNativeApp) {
      void import('@capacitor/network')
        .then(async ({ Network }) => {
          if (cancelled) return;
          const status = await Network.getStatus();
          if (cancelled) return;
          setOnline(status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => {
            setOnline(s.connected);
          });
          if (cancelled) {
            void handle.remove();
            return;
          }
          removeNativeListener = () => { void handle.remove(); };
        })
        .catch(() => {
          /* plugin unavailable → the navigator online/offline events still cover us */
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      removeNativeListener?.();
    };
  }, []);

  return online;
}
