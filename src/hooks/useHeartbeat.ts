import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds

/**
 * Sends a heartbeat (updates last_seen) every 60s while the user has the site open.
 * Also updates on visibility change (tab focus/blur).
 */
export const useHeartbeat = (userId: string | undefined, enabled: boolean) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId || !enabled) return;

    const sendHeartbeat = () => {
      supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() } as any)
        .eq('user_id', userId)
        .then(() => {});
    };

    // Send immediately on mount
    sendHeartbeat();

    // Set interval
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Also send on visibility change (when tab becomes visible)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // On unmount / tab close, set last_seen to null to mark offline
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery on page close
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`;
      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        'Prefer': 'return=minimal',
      };
      const body = JSON.stringify({ last_seen: null });
      
      // Try sendBeacon first (most reliable on page close)
      const blob = new Blob([body], { type: 'application/json' });
      // sendBeacon doesn't support custom headers, so fall back to fetch keepalive
      try {
        fetch(url, {
          method: 'PATCH',
          headers,
          body,
          keepalive: true,
        });
      } catch {
        // Best effort
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, enabled]);
};
