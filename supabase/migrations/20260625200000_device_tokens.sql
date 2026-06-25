-- Push notifications: per-user device (FCM) tokens. The app registers on login and upserts its
-- token here; the send-push edge function (service role) reads them to deliver notifications.

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,                 -- one token belongs to one user; re-login re-points it
  platform text NOT NULL DEFAULT 'android',   -- android | ios | web
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens (user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Owners manage their own tokens (insert on register, upsert on re-register, delete on logout).
-- send-push uses the service role, which bypasses RLS, so no read policy for staff is needed.
DROP POLICY IF EXISTS "Users manage own device tokens" ON public.device_tokens;
CREATE POLICY "Users manage own device tokens"
  ON public.device_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
