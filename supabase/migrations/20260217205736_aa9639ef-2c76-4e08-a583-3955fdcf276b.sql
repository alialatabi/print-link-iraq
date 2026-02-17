
-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;

-- Users can only read their own profile
CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
);
