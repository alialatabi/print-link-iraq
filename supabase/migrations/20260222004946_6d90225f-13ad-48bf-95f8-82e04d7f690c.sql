
-- Drop the overly permissive designer policy
DROP POLICY IF EXISTS "Designers read assigned customer profiles" ON public.profiles;

-- Create a view that only exposes display_name for designers
CREATE OR REPLACE VIEW public.designer_customer_profiles AS
SELECT 
  p.user_id,
  p.display_name
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.orders o 
  WHERE o.customer_id = p.user_id 
    AND o.designer_id = auth.uid()
);

-- Grant access to the view
GRANT SELECT ON public.designer_customer_profiles TO authenticated;
