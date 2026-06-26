-- H1 (Security Audit): Coupon drain / TOCTOU / client-callable increment.
--
-- Before: public.increment_coupon_usage(coupon_id) was SECURITY DEFINER with the
-- default EXECUTE-to-PUBLIC grant, callable directly by any client, had no max_uses
-- guard, and ran in a separate non-atomic step from validation (TOCTOU). An attacker
-- could inflate/skip usage or push a capped coupon past max_uses with concurrent calls.
--
-- After: redemption is recorded once per order in a service-role-only table and the
-- counter is bumped with an atomic, capped UPDATE that is impossible to over-run.
-- The old unguarded function is removed.

-- 1. One-redemption-per-order ledger (idempotency + audit). RLS on, no policies →
--    only SECURITY DEFINER functions / the service role can touch it.
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- 2. Retire the unguarded, world-executable increment function.
DROP FUNCTION IF EXISTS public.increment_coupon_usage(uuid);

-- 3. Atomic, order-tied redemption. Verifies the order belongs to the caller, records
--    the redemption exactly once, and only then bumps used_count under the cap. Returns
--    true when this call consumed a use, false if it was already redeemed for this order.
CREATE OR REPLACE FUNCTION public.redeem_coupon(p_coupon_id uuid, p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_inserted  boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- The order must exist and belong to the caller.
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id AND o.customer_id = v_uid
  ) THEN
    RAISE EXCEPTION 'order not found for caller' USING ERRCODE = '42501';
  END IF;

  -- Record the redemption once per order (idempotent on retry / double-submit).
  INSERT INTO public.coupon_redemptions (coupon_id, order_id, user_id)
  VALUES (p_coupon_id, p_order_id, v_uid)
  ON CONFLICT (order_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    -- Atomic, capped bump: a maxed-out / inactive / expired coupon is a no-op here,
    -- so concurrent redemptions can never push used_count past max_uses.
    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE id = p_coupon_id
      AND is_active
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR used_count < max_uses);
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 4. Only authenticated users may redeem (the function itself enforces ownership);
--    nothing is granted to anon/public.
REVOKE ALL ON FUNCTION public.redeem_coupon(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(uuid, uuid) TO authenticated;
