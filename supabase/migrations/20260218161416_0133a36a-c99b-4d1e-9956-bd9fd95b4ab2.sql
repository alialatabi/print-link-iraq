
-- Table to store OTP codes
CREATE TABLE public.otp_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_otp_codes_phone_code ON public.otp_codes (phone, code);

-- Auto-cleanup expired codes (optional: can be done via cron later)
-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can manage OTP codes - no public access
-- No RLS policies needed since only edge functions with service_role key access this table
