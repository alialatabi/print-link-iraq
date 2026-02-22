
CREATE OR REPLACE FUNCTION public.auto_assign_designer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _designer_id uuid;
BEGIN
  IF NEW.status = 'submitted' AND NEW.designer_id IS NULL THEN
    SELECT ur.user_id INTO _designer_id
    FROM user_roles ur
    INNER JOIN profiles p ON p.user_id = ur.user_id
    WHERE ur.role = 'designer'
      AND p.is_active = true
      AND p.last_seen IS NOT NULL
      AND p.last_seen > (now() - interval '3 minutes')
    ORDER BY (
      SELECT count(*) FROM orders o
      WHERE o.designer_id = ur.user_id
        AND o.status NOT IN ('delivered', 'draft', 'cancelled')
    ) ASC, random()
    LIMIT 1;

    IF _designer_id IS NOT NULL THEN
      NEW.designer_id := _designer_id;
      NEW.status := 'assigned';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
