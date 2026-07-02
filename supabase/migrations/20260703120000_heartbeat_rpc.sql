-- Heartbeat presence write -> one atomic RPC (UX audit §D P2).
--
-- useHeartbeat used to SELECT total_time_seconds and then UPDATE it (+60) on every 60s beat: two
-- round-trips AND a read-modify-write race (two open tabs could clobber each other's increment).
-- Replace both with a SINGLE statement that atomically bumps last_seen and adds the elapsed seconds
-- to the CALLER'S OWN row.
--
-- Privilege choice — SECURITY INVOKER (least privilege): the client already updates its own profile
-- directly under the "Users update own profile" RLS policy (20260222211856:
-- USING auth.uid() = user_id WITH CHECK auth.uid() = user_id), so this caller needs NO elevation.
-- Running as INVOKER keeps RLS as the security boundary — even a bug in the WHERE clause cannot
-- reach another account's row — and the existing BEFORE UPDATE triggers (protect_is_super_admin,
-- update_profiles_updated_at) fire exactly as they do for the current client UPDATE, so behaviour is
-- unchanged; only the write is now atomic and single-trip. (Contrast create_order_with_items, which
-- is DEFINER because it must insert with a status/triggers the user's own RLS would not allow.)
--
-- The row is scoped by auth.uid() INSIDE the function; a user id is NEVER accepted from the client.
-- GREATEST(0, …) guards against a negative/absent p_seconds ever DECREMENTing the counter. VOLATILE
-- because it writes. SET search_path = public hardens name resolution.
--
-- Deploy note: FILE ONLY — safe to ship the frontend before this is applied. The hook swallows the
-- "function does not exist" error until this lands (heartbeat is best-effort telemetry).

CREATE OR REPLACE FUNCTION public.heartbeat_increment(p_seconds int)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.profiles
     SET last_seen = now(),
         total_time_seconds = total_time_seconds + GREATEST(0, COALESCE(p_seconds, 0))
   WHERE user_id = auth.uid();
$$;

-- authenticated-only. Supabase's default privileges GRANT EXECUTE on every new function to BOTH
-- PUBLIC and anon DIRECTLY, so REVOKE FROM PUBLIC alone leaves the anon grant intact (this is exactly
-- why 20260703093000 had to add a separate REVOKE ... FROM anon for create_order_with_items) — revoke
-- both explicitly, then grant only authenticated.
REVOKE ALL ON FUNCTION public.heartbeat_increment(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.heartbeat_increment(int) FROM anon;
GRANT EXECUTE ON FUNCTION public.heartbeat_increment(int) TO authenticated;
