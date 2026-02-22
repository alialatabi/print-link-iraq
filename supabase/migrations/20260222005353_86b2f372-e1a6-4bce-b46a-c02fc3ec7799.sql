
-- Explicitly deny anonymous access to profiles
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles AS RESTRICTIVE FOR SELECT
TO anon
USING (false);

-- Explicitly deny anonymous write access
CREATE POLICY "Deny anonymous write to profiles"
ON public.profiles AS RESTRICTIVE FOR INSERT
TO anon
WITH CHECK (false);

CREATE POLICY "Deny anonymous update to profiles"
ON public.profiles AS RESTRICTIVE FOR UPDATE
TO anon
USING (false);

CREATE POLICY "Deny anonymous delete to profiles"
ON public.profiles AS RESTRICTIVE FOR DELETE
TO anon
USING (false);
