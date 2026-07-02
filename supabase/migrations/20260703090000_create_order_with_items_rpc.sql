-- Checkout submit atomicity (UX audit consolidated P0 #1 — closing the last gap).
--
-- The cart-submit flow is already idempotent (client-generated UUIDs, upload-first, retryAsync),
-- but it still inserts the order and its items in SEPARATE requests. A PERSISTENT item-insert
-- failure mid-submit therefore leaves a partial order the customer CANNOT clean up: the orders /
-- order_items DELETE policies only allow a customer to delete a *draft* order (see 20260217001834
-- and 20260223131201), and the BEFORE INSERT auto_assign_designer trigger immediately flips a new
-- 'submitted' order to 'assigned' — so there is no customer-reachable path to remove the orphan.
--
-- Fix: one SECURITY DEFINER function that inserts the order + ALL its items in a SINGLE
-- transaction, idempotently. Same design as redeem_coupon (20260626120000) and the SQL style of
-- popular_templates (20260702120000):
--   * auth.uid() is the trust anchor. customer_id is taken from the JWT, NEVER from the payload;
--     the caller must declare the same id or the call is rejected (no cross-account inserts).
--   * ON CONFLICT (id) DO NOTHING on BOTH inserts makes a retry after a dropped response converge
--     to the SAME order/items instead of erroring or duplicating, and it also reconciles a partial
--     order left behind by the older two-request path (same UUIDs).
--   * A plain INSERT inside this plpgsql function still fires EVERY orders trigger exactly as the
--     old client INSERT did — behaviour is unchanged, the writes are just now atomic:
--       BEFORE INSERT  validate_order_details_trigger  (details size / revisions guard)
--       BEFORE INSERT  trg_auto_assign_designer        (may set designer_id + status -> assigned)
--       AFTER  INSERT  trg_notify_admin_on_new_order   (admin notification)
--     Order status is inserted as 'submitted' and item status as 'submitted', identical to the
--     previous createCartOrder / insertCartOrderItem calls.
--
-- VOLATILE (it writes — STABLE would be wrong). VULNERABILITY NOTE: because this is SECURITY
-- DEFINER it bypasses RLS, so the in-function ownership checks ARE the security boundary.
--
-- Deploy order: APPLY THIS MIGRATION BEFORE shipping the frontend that calls it.

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_order_id     uuid,
  p_customer_id  uuid,
  p_details      jsonb,
  p_items        jsonb
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Trust anchor: only the authenticated owner may create their own order.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Never trust the payload for identity: the declared customer must match the JWT.
  IF p_customer_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'cannot create an order for another account' USING ERRCODE = '42501';
  END IF;

  -- 1. The order. status = 'submitted' lets the BEFORE INSERT triggers run exactly as the old
  --    client insert did (auto_assign_designer may flip it to 'assigned' and set designer_id).
  --    ON CONFLICT: a retry whose earlier attempt already created the order is a no-op.
  INSERT INTO public.orders (id, customer_id, status, details)
  VALUES (p_order_id, v_uid, 'submitted'::public.order_status, COALESCE(p_details, '{}'::jsonb))
  ON CONFLICT (id) DO NOTHING;

  -- Ownership guard for the paranoid case where p_order_id already exists from ANOTHER account
  -- (the insert above then no-ops): never attach items to an order the caller does not own.
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id AND o.customer_id = v_uid
  ) THEN
    RAISE EXCEPTION 'order does not belong to caller' USING ERRCODE = '42501';
  END IF;

  -- 2. Every item in one statement. template_id is null for AI-designed items (JSON null ->
  --    SQL NULL); status = 'submitted' matches the old per-item insert. Same ON CONFLICT
  --    idempotency keyed on the client-supplied item id.
  INSERT INTO public.order_items (id, order_id, template_id, details, status)
  SELECT
    (elem->>'id')::uuid,
    p_order_id,
    (elem->>'template_id')::uuid,
    COALESCE(elem->'details', '{}'::jsonb),
    'submitted'::public.order_status
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS elem
  ON CONFLICT (id) DO NOTHING;

  -- Success marker: the order id, whether this call created the rows or a prior attempt did —
  -- so a retry after a network drop converges to success.
  RETURN p_order_id;
END;
$$;

-- Only authenticated users may call it; ownership is enforced inside the function. Nothing to anon.
REVOKE ALL ON FUNCTION public.create_order_with_items(uuid, uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(uuid, uuid, jsonb, jsonb) TO authenticated;
