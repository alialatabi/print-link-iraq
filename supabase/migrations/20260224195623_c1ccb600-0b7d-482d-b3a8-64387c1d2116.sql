CREATE OR REPLACE FUNCTION public.auto_mark_paid_on_printed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _price integer;
  _qty integer;
  _service_type text;
BEGIN
  IF NEW.status = 'printed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT t.service_type INTO _service_type FROM public.templates t WHERE t.id = NEW.template_id;
    SELECT COALESCE(s.price, 0) INTO _price FROM public.services s WHERE s.id = _service_type;
    
    _qty := COALESCE((NEW.details->>'quantity')::integer, 1000);
    
    -- Calculate total: price per 1000 * (qty / 1000)
    NEW.paid_amount := CEIL(_price * (_qty::numeric / 1000));
    NEW.payment_status := 'paid';
  END IF;
  
  RETURN NEW;
END;
$function$;