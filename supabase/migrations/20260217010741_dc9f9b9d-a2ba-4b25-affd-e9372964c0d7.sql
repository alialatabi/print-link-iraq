
-- Replace overly permissive INSERT policy with a restrictive one
-- Only admins can manually insert notifications; the trigger uses SECURITY DEFINER
DROP POLICY "System inserts notifications" ON public.notifications;

CREATE POLICY "Only admins insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
