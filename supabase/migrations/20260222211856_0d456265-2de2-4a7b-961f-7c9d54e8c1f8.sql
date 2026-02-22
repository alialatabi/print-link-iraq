
-- Drop existing SELECT policies on profiles
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;

-- Permissive: authenticated users read own profile only
CREATE POLICY "Users read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Permissive: admins read all profiles (needed for admin panel)
CREATE POLICY "Admins read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Restrictive: explicitly deny anonymous access
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles AS RESTRICTIVE FOR SELECT
TO anon
USING (false);

-- Also fix the UPDATE policy to have proper TO clause
DROP POLICY IF EXISTS "Deny anonymous update to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deny anonymous update to profiles"
ON public.profiles AS RESTRICTIVE FOR UPDATE
TO anon
USING (false);

-- Fix INSERT policies
DROP POLICY IF EXISTS "Deny anonymous write to profiles" ON public.profiles;
DROP POLICY IF EXISTS "System inserts profiles" ON public.profiles;

CREATE POLICY "System inserts profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Deny anonymous write to profiles"
ON public.profiles AS RESTRICTIVE FOR INSERT
TO anon
WITH CHECK (false);

-- Fix DELETE policies
DROP POLICY IF EXISTS "Deny anonymous delete to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users delete own profile" ON public.profiles;

CREATE POLICY "Users delete own profile"
ON public.profiles FOR DELETE
TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Deny anonymous delete to profiles"
ON public.profiles AS RESTRICTIVE FOR DELETE
TO anon
USING (false);
