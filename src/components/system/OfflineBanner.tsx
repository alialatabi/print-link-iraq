import { useEffect, useRef, useState } from 'react';
import { useOnline } from '@/hooks/useOnline';

/** How long the "connection restored" confirmation stays up before auto-hiding (ms). */
const RECONNECT_FLASH_MS = 2500;

/**
 * Fixed banner pinned to the top of the screen that appears when the device loses its internet
 * connection ("لا يوجد اتصال بالإنترنت") and briefly confirms recovery ("عاد الاتصال") before it
 * auto-hides.
 *
 * Mounted at the app root (src/main.tsx) so it must not depend on router context. Sits above the
 * sticky page headers (z-[100]) and pads for the notch via env(safe-area-inset-top) so its text
 * clears the status bar on native.
 */
const OfflineBanner = () => {
  const online = useOnline();
  const [visible, setVisible] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      // Offline: show the persistent warning and remember we were offline this session.
      wasOffline.current = true;
      setReconnected(false);
      setVisible(true);
      return;
    }

    if (wasOffline.current) {
      // Back online after a drop: flash a brief confirmation, then auto-hide.
      wasOffline.current = false;
      setReconnected(true);
      setVisible(true);
      const timer = window.setTimeout(() => setVisible(false), RECONNECT_FLASH_MS);
      return () => window.clearTimeout(timer);
    }

    // Online and never dropped → nothing to show.
    setVisible(false);
  }, [online]);

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-[100] pt-[env(safe-area-inset-top)] shadow-md animate-in fade-in slide-in-from-top-4 duration-300 ${
        reconnected ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      <p className="py-2 px-4 text-center text-white text-[13px] font-bold font-tajawal">
        {reconnected ? 'عاد الاتصال' : 'لا يوجد اتصال بالإنترنت'}
      </p>
    </div>
  );
};

export default OfflineBanner;
