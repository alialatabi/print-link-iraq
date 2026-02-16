
-- Function to auto-assign orders to designer with fewest active orders
CREATE OR REPLACE FUNCTION public.auto_assign_designer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _designer_id uuid;
BEGIN
  -- Only auto-assign when status is 'submitted' and no designer assigned
  IF NEW.status = 'submitted' AND NEW.designer_id IS NULL THEN
    -- Pick the designer with the fewest active (non-delivered) orders
    SELECT ur.user_id INTO _designer_id
    FROM user_roles ur
    WHERE ur.role = 'designer'
    ORDER BY (
      SELECT count(*) FROM orders o
      WHERE o.designer_id = ur.user_id
        AND o.status NOT IN ('delivered', 'draft')
    ) ASC, random()
    LIMIT 1;

    IF _designer_id IS NOT NULL THEN
      NEW.designer_id := _designer_id;
      NEW.status := 'assigned';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on insert
CREATE TRIGGER trg_auto_assign_designer
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_designer();

-- Also trigger on update (when status changes to submitted)
CREATE TRIGGER trg_auto_assign_designer_update
BEFORE UPDATE ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'submitted' AND NEW.designer_id IS NULL)
EXECUTE FUNCTION public.auto_assign_designer();
