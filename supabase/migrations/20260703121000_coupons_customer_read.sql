-- M3 (Security Audit): "Coupons unreadable by customers".
--
-- Migration 20260225225532 dropped the last non-admin SELECT policy on public.coupons, leaving only
-- "Admins manage coupons" (FOR ALL). Any customer-side `select` on the table now returns zero rows
-- (RLS deny), so the /my-coupons page can't list the promo codes it exists to show, and any future
-- referral/loyalty read is blocked too. (Today the page limps along through the validate-coupon edge
-- function's service-role `list` action; this replaces that service-role hop with a caller-JWT read.)
--
-- Why a SECURITY DEFINER RPC and NOT a table SELECT policy:
--   coupons are GLOBAL codes (no customer_id / assigned_to column) that also carry bookkeeping the
--   customer must never see: used_count and max_uses. The edge function deliberately strips those
--   ("Return active coupons with limited fields (no used_count/max_uses)"). An RLS SELECT policy gates
--   ROWS, not COLUMNS: a policy like `FOR SELECT TO authenticated USING (is_active AND ...)` would let
--   ANY logged-in user run `select used_count, max_uses from coupons` and read that bookkeeping for
--   every active code — more than the page needs and more than the product ever exposed. A definer
--   function is the only way to expose exactly the four rendered columns and nothing else while the
--   table itself stays admin-only + service-role. This function mirrors, in-database, the edge
--   function's `list` action (same columns, same active / not-expired / not-maxed filter), so the page
--   reads with the caller's own JWT instead of a service-role round trip.
--
-- Exposure is unchanged vs. today: the edge `list` action already returns every active coupon to any
-- authenticated user; this is the same set, just narrower at the column level and without service role.
-- It NEVER exposes: inactive/expired/maxed codes, used_count, max_uses, created_at, or anon callers.

CREATE OR REPLACE FUNCTION public.my_coupons()
RETURNS TABLE (
  id         uuid,
  code       text,
  percentage integer,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.percentage, c.expires_at
  FROM public.coupons c
  WHERE c.is_active
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses  IS NULL OR c.used_count < c.max_uses)
  ORDER BY c.created_at DESC;
$$;

-- Authenticated customers only. No per-user rows means no auth.uid() row filter is needed; the grant
-- IS the gate. Supabase's default privileges grant EXECUTE on new functions to BOTH public and anon
-- (see the anon-revoke in 20260703093000), so revoke from both before granting authenticated — anon
-- has no business enumerating promo codes.
REVOKE ALL ON FUNCTION public.my_coupons() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_coupons() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_coupons() TO authenticated;
