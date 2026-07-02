-- Fix: notify_admin_on_new_order still read NEW.customer_name, but that column was
-- dropped in 20260220184022 ("Customer info should be fetched from profiles").
-- When the trigger fired (orders remaining 'submitted' — e.g. no active designer to
-- auto-assign), "record NEW has no field customer_name" aborted the whole order INSERT.
-- Same behavior, but the name now comes from profiles.display_name.

CREATE OR REPLACE FUNCTION public.notify_admin_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_id uuid;
  v_customer_name text;
BEGIN
  -- Fire when status becomes 'submitted' (new order)
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    SELECT display_name INTO v_customer_name
    FROM public.profiles
    WHERE user_id = NEW.customer_id;

    FOR admin_id IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, order_id, title, message)
      VALUES (
        admin_id,
        NEW.id,
        'طلب جديد 🆕',
        'وصل طلب جديد من: ' || COALESCE(NULLIF(v_customer_name, ''), 'زبون')
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
