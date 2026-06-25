-- SECURITY: the "Users update own profile" RLS policy is USING (auth.uid() = user_id) with no
-- column restriction, so an authenticated user could set is_super_admin=true on their OWN profile.
-- (Bounded — admin-panel access also needs the 'admin' role, and user_roles writes are admin-only —
-- but it lets a non-admin mark themselves a super admin: undeletable + hidden from the customers list,
-- and instant super admin if they ever get the admin role.) Lock the flag down with a trigger:
-- only an admin (or the service role, where auth.uid() is NULL — migrations/edge functions) may
-- change is_super_admin; any other writer has their change to that column silently reverted.

CREATE OR REPLACE FUNCTION public.protect_is_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_super_admin := OLD.is_super_admin;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_is_super_admin_trigger ON public.profiles;
CREATE TRIGGER protect_is_super_admin_trigger
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.protect_is_super_admin();
