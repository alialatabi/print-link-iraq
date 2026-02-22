
-- Drop the view approach, use RPC instead
DROP VIEW IF EXISTS public.designer_customer_profiles;

-- Create a secure function for designers to get customer names
CREATE OR REPLACE FUNCTION public.get_customer_names_for_designer(customer_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.user_id = ANY(customer_ids)
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.customer_id = p.user_id
        AND o.designer_id = auth.uid()
    )
$$;
