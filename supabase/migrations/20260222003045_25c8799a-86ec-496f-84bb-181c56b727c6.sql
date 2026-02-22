
CREATE OR REPLACE FUNCTION public.notify_designer_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Fire when status changes to 'approved' and designer is assigned
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.designer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, order_id, title, message)
    VALUES (
      NEW.designer_id,
      NEW.id,
      'تمت الموافقة على التصميم ✅',
      'وافق الزبون على التصميم — يرجى رفع الملف الجاهز للطبع'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_designer_on_approval
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_designer_on_approval();
