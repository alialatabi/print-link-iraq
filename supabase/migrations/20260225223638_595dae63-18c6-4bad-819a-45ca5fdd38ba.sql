
-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Anyone can read coupons" ON public.coupons;

-- Only authenticated users can read coupons
CREATE POLICY "Authenticated users read coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (true);
