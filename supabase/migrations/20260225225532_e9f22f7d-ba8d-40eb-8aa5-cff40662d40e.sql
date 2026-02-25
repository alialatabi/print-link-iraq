
-- Remove the authenticated users read policy, keep admin-only access
DROP POLICY IF EXISTS "Authenticated users read coupons" ON public.coupons;
DROP POLICY IF EXISTS "Anyone can read coupons" ON public.coupons;
