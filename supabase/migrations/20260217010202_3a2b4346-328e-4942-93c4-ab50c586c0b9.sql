
-- 1) Fix storage policy conflicts: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload template previews" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update template previews" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete template previews" ON storage.objects;
DROP POLICY IF EXISTS "Public can view template previews" ON storage.objects;

-- 2) Protect payment fields: add trigger to block non-admin payment updates
CREATE OR REPLACE FUNCTION public.check_payment_update()
RETURNS TRIGGER AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  
  IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount 
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'Only admins can modify payment information';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_payment_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.check_payment_update();
