-- ─────────────────────────────────────────────────────────────────────────────
-- Code-based auth: phone + 6-digit PIN (a real bcrypt-hashed Supabase password),
-- OTP used ONLY for first-time phone verification and forgot-PIN recovery.
-- Also fixes Critical C4 (world-open `designs` storage bucket).
-- ─────────────────────────────────────────────────────────────────────────────

-- Whether a customer has chosen their 6-digit login code (PIN). NULL = not set yet.
-- Existing accounts (legacy derived password) keep NULL and are migrated on next
-- login: they verify by OTP once, then choose a PIN. Stamped by the set-pin function.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_set_at timestamptz;

-- Per-phone throttle for two independent server-side limits:
--   * OTP *sending*  → anti SMS-bombing / OTPIQ cost abuse (fixes H5)
--   * code *login*   → anti brute-force of the 1e6-space 6-digit PIN
-- Edge functions touch this with the service-role key; never reachable by clients.
CREATE TABLE IF NOT EXISTS public.phone_throttle (
  phone                 text PRIMARY KEY,
  otp_send_count        integer NOT NULL DEFAULT 0,
  otp_send_window_start timestamptz,
  login_attempts        integer NOT NULL DEFAULT 0,
  login_locked_until    timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.phone_throttle ENABLE ROW LEVEL SECURITY;

-- Explicit blanket denial for anon + authenticated (service_role bypasses RLS),
-- mirroring the locked-down otp_attempts/otp_codes tables.
DROP POLICY IF EXISTS "deny anon phone_throttle" ON public.phone_throttle;
CREATE POLICY "deny anon phone_throttle" ON public.phone_throttle
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny authenticated phone_throttle" ON public.phone_throttle;
CREATE POLICY "deny authenticated phone_throttle" ON public.phone_throttle
  AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ── Critical C4: drop the world-open `designs` bucket policies ──────────────────
-- These initial policies let ANY authenticated user read/upload ALL design files.
-- They were never dropped when the order-scoped policies were added, and permissive
-- policies OR together so the broad ones win. The scoped replacements already exist.
DROP POLICY IF EXISTS "Authenticated users upload designs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users read designs" ON storage.objects;
