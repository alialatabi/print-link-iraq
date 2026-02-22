
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _phone text;
BEGIN
  -- Get the phone of the user whose role is being deleted
  SELECT phone INTO _phone FROM public.profiles WHERE user_id = OLD.user_id;
  
  -- Normalize and check if it's the super admin
  IF _phone IS NOT NULL AND OLD.role = 'admin' THEN
    IF replace(replace(_phone, ' ', ''), '0', '964') = '9647838774435' 
       OR _phone = '9647838774435' 
       OR _phone = '07838774435' THEN
      RAISE EXCEPTION 'Cannot remove admin role from super admin';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin_role_trigger ON public.user_roles;
CREATE TRIGGER protect_super_admin_role_trigger
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_super_admin_role();
