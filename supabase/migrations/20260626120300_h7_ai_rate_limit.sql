-- H7 (Security Audit): AI generation rate limit had a TOCTOU race — the edge function
-- COUNTED today's ai_generations, then (after a ~20s OpenAI call) inserted a row. N
-- concurrent requests all pass the count check before any row lands, so a user can burst
-- well past the daily limit and run up real OpenAI cost.
--
-- Fix: an atomic per-user-per-day counter consumed BEFORE the OpenAI call. The increment
-- and the cap check happen in a single statement (row lock via ON CONFLICT), so the limit
-- can never be over-run. A best-effort release refunds the slot when generation fails.

CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  user_id  uuid NOT NULL,
  day      date NOT NULL,
  used     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies → only the service role / SECURITY DEFINER functions touch it.

-- Atomically reserve one generation slot for today. Returns the new used-count, or NULL
-- when the user is already at/over the limit (the ON CONFLICT update is gated by the cap,
-- so a maxed-out row is left untouched and nothing is returned).
CREATE OR REPLACE FUNCTION public.reserve_ai_generation(p_user_id uuid, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_used integer;
BEGIN
  INSERT INTO public.ai_rate_limits (user_id, day, used)
  VALUES (p_user_id, (now() AT TIME ZONE 'utc')::date, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET used = public.ai_rate_limits.used + 1
    WHERE public.ai_rate_limits.used < p_limit
  RETURNING used INTO v_used;

  RETURN v_used; -- NULL when the cap blocked the increment
END;
$$;

-- Refund a slot when the reserved generation ultimately fails (best-effort, never below 0).
CREATE OR REPLACE FUNCTION public.release_ai_generation(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.ai_rate_limits
  SET used = greatest(used - 1, 0)
  WHERE user_id = p_user_id
    AND day = (now() AT TIME ZONE 'utc')::date;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_ai_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ai_generation(uuid) TO service_role;
