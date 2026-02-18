
CREATE OR REPLACE FUNCTION public.auto_mark_paid_on_printed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  _price integer;
  _qty integer;
BEGIN
  -- Only when status changes to 'printed'
  IF NEW.status = 'printed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get template price
    SELECT COALESCE(price, 0) INTO _price FROM public.templates WHERE id = NEW.template_id;
    
    -- Get quantity from details (default 1000)
    _qty := COALESCE((NEW.details->>'quantity')::integer, 1000);
    
    -- Calculate total: price per 1000 * (qty / 1000)
    NEW.paid_amount := _price * (_qty / 1000);
    NEW.payment_status := 'paid';
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_auto_mark_paid_on_printed
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_mark_paid_on_printed();
