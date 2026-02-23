
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read activity logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert activity logs" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny anon activity logs" ON public.activity_logs
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs (created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
