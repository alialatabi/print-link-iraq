
-- Add is_super_admin column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Set the original super admin
UPDATE public.profiles SET is_super_admin = true WHERE phone = '9647838774435' OR phone = '07838774435';

-- Update the protect_super_admin_role trigger to protect ALL super admins
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_super boolean;
BEGIN
  -- Check if the user whose role is being deleted is a super admin
  SELECT is_super_admin INTO _is_super FROM public.profiles WHERE user_id = OLD.user_id;
  
  IF _is_super = true AND OLD.role = 'admin' THEN
    RAISE EXCEPTION 'Cannot remove admin role from super admin';
  END IF;
  
  RETURN OLD;
END;
$function$;
