
-- Enable RLS on otp_codes (already enabled but no policies exist)
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow only service_role to insert OTP codes (edge functions use service_role)
CREATE POLICY "Service role insert otp_codes"
ON public.otp_codes FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow only service_role to select OTP codes
CREATE POLICY "Service role select otp_codes"
ON public.otp_codes FOR SELECT
TO service_role
USING (true);

-- Allow only service_role to update OTP codes (mark as used)
CREATE POLICY "Service role update otp_codes"
ON public.otp_codes FOR UPDATE
TO service_role
USING (true);

-- Allow only service_role to delete OTP codes
CREATE POLICY "Service role delete otp_codes"
ON public.otp_codes FOR DELETE
TO service_role
USING (true);

-- Explicitly deny anon and authenticated users from reading OTP codes
CREATE POLICY "Deny anon read otp_codes"
ON public.otp_codes AS RESTRICTIVE FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny authenticated read otp_codes"
ON public.otp_codes AS RESTRICTIVE FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "Deny anon write otp_codes"
ON public.otp_codes AS RESTRICTIVE FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Deny authenticated write otp_codes"
ON public.otp_codes AS RESTRICTIVE FOR INSERT
TO authenticated
WITH CHECK (false);
