-- Fix: orders could never reach status 'printed' when they are item-based.
--
-- auto_mark_paid_on_printed derived paid_amount ONLY from orders.template_id →
-- templates.service_type → services.price. Cart / AI / reseller orders have
-- orders.template_id = NULL (their templates live on order_items), so _price stayed
-- NULL, paid_amount was assigned NULL and the UPDATE aborted with a 23502 NOT NULL
-- violation — blocking the whole submitted→printed transition, keeping
-- payment_status stuck at 'unpaid', zeroing revenue stats and emptying the
-- printed-orders export.
--
-- New resolution order (mirrors the app's own pricing contract in
-- src/lib/orderPricing.ts — every order-creation path stores an immutable
-- `pricing` snapshot: on each order_items row for cart orders, on orders.details
-- for single-item / upload / reseller / AI-direct orders):
--   1) Order HAS items  → sum per-item `details.pricing.line_total` (the exact
--      amount the app charged, discounts included). Legacy items without a
--      snapshot fall back to the catalog through the item's template:
--      round(price × quantity / min_quantity), mirroring computeLine().
--   2) No items, but orders.details carries a pricing snapshot → use its line_total.
--   3) Legacy template orders → original template_id → services.price math.
-- paid_amount is NOT NULL, so the final value is always COALESCEd to 0 — a pricing
-- gap must never abort the printed transition again.

CREATE OR REPLACE FUNCTION public.auto_mark_paid_on_printed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _total numeric;
  _price integer;
  _qty integer;
  _service_type text;
BEGIN
  IF NEW.status = 'printed' AND OLD.status IS DISTINCT FROM NEW.status THEN

    -- 1) Item-based orders (cart / AI / reseller): sum the per-item line totals.
    --    Primary source is the immutable pricing snapshot written at checkout
    --    (line_total = unit_price × quantity / min_quantity, rounded, AFTER any
    --    coupon discount). Numeric-looking values only — a malformed snapshot
    --    falls through to the catalog fallback instead of throwing.
    SELECT SUM(
      COALESCE(
        CASE WHEN (oi.details->'pricing'->>'line_total') ~ '^-?[0-9]+(\.[0-9]+)?$'
             THEN (oi.details->'pricing'->>'line_total')::numeric
        END,
        ROUND(
          COALESCE(s.price, 0)::numeric
          * COALESCE(
              CASE WHEN (oi.details->>'quantity') ~ '^[0-9]+$'
                   THEN (oi.details->>'quantity')::numeric
              END,
              NULLIF(s.min_quantity, 0)::numeric,
              1000
            )
          / COALESCE(NULLIF(s.min_quantity, 0), 1000)
        ),
        0
      )
    )
    INTO _total
    FROM public.order_items oi
    LEFT JOIN public.templates t ON t.id = oi.template_id
    LEFT JOIN public.services  s ON s.id = t.service_type
    WHERE oi.order_id = NEW.id;

    -- 2) No items: single-item / upload / reseller / AI-direct orders store the
    --    pricing snapshot on the order row itself.
    IF _total IS NULL AND (NEW.details->'pricing'->>'line_total') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      _total := (NEW.details->'pricing'->>'line_total')::numeric;
    END IF;

    -- 3) Legacy template orders (pre-snapshot): original catalog math, unchanged.
    IF _total IS NULL THEN
      SELECT t.service_type INTO _service_type FROM public.templates t WHERE t.id = NEW.template_id;
      SELECT COALESCE(s.price, 0) INTO _price FROM public.services s WHERE s.id = _service_type;

      _qty := COALESCE((NEW.details->>'quantity')::integer, 1000);

      -- Calculate total: price per 1000 * (qty / 1000)
      _total := CEIL(COALESCE(_price, 0) * (_qty::numeric / 1000));
    END IF;

    -- paid_amount is NOT NULL — never let a NULL total abort the printed transition (23502).
    NEW.paid_amount := COALESCE(_total, 0);
    NEW.payment_status := 'paid';
  END IF;

  RETURN NEW;
END;
$function$;
