-- OTP re-verification window: customers verify by OTP on first sign-in, then are NOT asked again
-- for OTP_VALIDITY_DAYS (3 weeks). We track the last successful OTP verification per user here;
-- send-otp auto-logs-in (no code) when it's within the window, verify-otp stamps it, and the client
-- forces a re-OTP once it's older than the window.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_otp_verified_at timestamptz;

COMMENT ON COLUMN public.profiles.last_otp_verified_at IS
  'When this customer last verified by OTP. Within the 3-week window, send-otp auto-logs them in without a new code; after it, OTP is required again.';
