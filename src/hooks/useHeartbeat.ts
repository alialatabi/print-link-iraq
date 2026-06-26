import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds

/**
 * Sends a heartbeat (updates last_seen + increments total_time_seconds) every 60s
 * while the user has the site open. Also updates on visibility change.
 */
export const useHeartbeat = (userId: string | undefined, enabled: boolean) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (!userId || !enabled) return;
    isFirstRef.current = true;

    const sendHeartbeat = async () => {
      const now = new Date().toISOString();

      if (isFirstRef.current) {
        // First heartbeat: just set last_seen, don't increment time
        isFirstRef.current = false;
        await supabase
          .from('profiles')
          .update({ last_seen: now })
          .eq('user_id', userId);
      } else {
        // Subsequent: update last_seen AND increment time by 60s
        // Use RPC to atomically increment
        const { data: profile } = await supabase
          .from('profiles')
          .select('total_time_seconds')
          .eq('user_id', userId)
          .single();
        
        const currentTime = profile?.total_time_seconds || 0;
        await supabase
          .from('profiles')
          .update({ last_seen: now, total_time_seconds: currentTime + 60 })
          .eq('user_id', userId);
      }
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

    // On unmount / tab close — no longer nullify last_seen, keep the timestamp
    // so admin can see "آخر ظهور" properly
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, enabled]);
};
