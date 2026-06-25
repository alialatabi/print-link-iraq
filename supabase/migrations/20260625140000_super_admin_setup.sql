-- Designate 07838774435 as the SUPER ADMIN.
-- This user currently has only the 'customer' role + is_super_admin=false, so we (1) grant the
-- 'admin' role and (2) set is_super_admin (the flag AuthContext reads to unlock super-admin powers
-- and the admin-delete-user / create-admin guards check). Idempotent; matches either phone format.

INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::app_role
FROM public.profiles p
WHERE p.phone IN ('07838774435', '9647838774435')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = 'admin'::app_role
  );

UPDATE public.profiles
SET is_super_admin = true
WHERE phone IN ('07838774435', '9647838774435');
