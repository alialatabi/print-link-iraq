import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 60_000; // 60 seconds
const HEARTBEAT_SECONDS = 60; // seconds credited per interval beat (matches the cadence)

/**
 * Keeps the signed-in user's presence fresh while the site is open. Every 60s it calls the
 * heartbeat_increment RPC, which ATOMICALLY sets last_seen = now() and adds the elapsed seconds to
 * total_time_seconds in a single round-trip — replacing the old SELECT-then-UPDATE read/modify/write
 * (two requests per beat, and a race where two open tabs could clobber each other's increment).
 *
 * There is deliberately NO immediate on-mount beat: the first beat fires after one full interval, so
 * the heartbeat never piles onto the post-login request burst (UX audit §D P2). A tab regaining
 * visibility refreshes last_seen only (0 seconds credited) so returning to a backgrounded tab keeps
 * the user marked "online" — designer auto-assign routes on a fresh last_seen — without inflating
 * total_time_seconds the way the old visibility handler (a full +60) did.
 *
 * auth.uid() inside the RPC is the trust anchor — no user id is ever passed from the client.
 */
export const useHeartbeat = (userId: string | undefined, enabled: boolean) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId || !enabled) return;

    // One atomic beat. Resilient by design: heartbeat is pure background telemetry, so ANY failure —
    // including the RPC not existing before its migration is applied — is swallowed and NEVER
    // surfaced to the UI. Untyped RPC (added after types were generated) → cast the name + args.
    const beat = async (seconds: number) => {
      try {
        await supabase.rpc('heartbeat_increment' as never, { p_seconds: seconds } as never);
      } catch {
        /* best-effort telemetry — swallow */
      }
    };

    // No immediate beat: the first credit lands after one full interval (keeps it off the post-login
    // load path), then a steady 60s cadence, one atomic RPC per beat.
    intervalRef.current = setInterval(() => { void beat(HEARTBEAT_SECONDS); }, HEARTBEAT_INTERVAL);

    // Returning to the tab refreshes last_seen without crediting time (0 seconds).
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void beat(0);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // On unmount / tab close we no longer nullify last_seen — the timestamp stays so admin still sees
    // an accurate "آخر ظهور".
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, enabled]);
};
