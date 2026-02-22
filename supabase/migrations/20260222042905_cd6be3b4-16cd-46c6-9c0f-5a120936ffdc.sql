
-- Add price and cost columns to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price integer NOT NULL DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS cost integer NOT NULL DEFAULT 0;

-- Create expenses table for manual expense tracking
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'عام',
  notes text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Only admins can manage expenses
CREATE POLICY "Admins read expenses" ON public.expenses FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert expenses" ON public.expenses FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update expenses" ON public.expenses FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete expenses" ON public.expenses FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Update the auto_mark_paid trigger to use service price instead of template price
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
    -- Get the service_type from the template, then get price from service
    SELECT t.service_type INTO _service_type FROM public.templates t WHERE t.id = NEW.template_id;
    SELECT COALESCE(s.price, 0) INTO _price FROM public.services s WHERE s.id = _service_type;
    
    _qty := COALESCE((NEW.details->>'quantity')::integer, 1000);
    
    -- Calculate total: price per 1000 * (qty / 1000)
    NEW.paid_amount := _price * (_qty / 1000);
    NEW.payment_status := 'paid';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Enable realtime for expenses
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
