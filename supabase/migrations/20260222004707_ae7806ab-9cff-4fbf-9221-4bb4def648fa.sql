
CREATE TABLE IF NOT EXISTS public.otp_attempts (
  phone text NOT NULL PRIMARY KEY,
  attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_attempt timestamptz DEFAULT now()
);

ALTER TABLE public.otp_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon otp_attempts" ON public.otp_attempts FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny auth otp_attempts" ON public.otp_attempts FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Service role otp_attempts" ON public.otp_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
