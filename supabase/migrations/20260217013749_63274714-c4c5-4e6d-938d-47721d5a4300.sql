-- 1. Add DELETE policy for notifications so users can clean up
CREATE POLICY "Users delete own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- 2. Add validation trigger for order details JSONB
CREATE OR REPLACE FUNCTION public.validate_order_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Limit overall JSONB size to 1MB
  IF length(NEW.details::text) > 1048576 THEN
    RAISE EXCEPTION 'Order details too large';
  END IF;

  -- Limit revisions array size
  IF NEW.details ? 'revisions' AND jsonb_array_length(NEW.details->'revisions') > 50 THEN
    RAISE EXCEPTION 'Too many revisions';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_order_details_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_details();
