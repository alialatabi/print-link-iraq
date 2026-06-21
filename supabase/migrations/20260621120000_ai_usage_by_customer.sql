-- Admin AI-usage tracker: per-customer rollup of how much each customer uses the AI design
-- feature, which products they designed, and how much they spent on AI design fees.
--
-- Two sources are combined per (customer, product):
--   * public.ai_generations  -> every generation attempt = "usage" (includes drafts never ordered)
--   * public.order_items      -> AI items actually ordered (details.is_ai_design) = money (unit_price)
-- SECURITY DEFINER + an explicit admin guard, because it reads across all customers.

CREATE OR REPLACE FUNCTION public.ai_usage_by_customer()
RETURNS TABLE (
  user_id           uuid,
  display_name      text,
  phone             text,
  total_generations bigint,
  ordered_items     bigint,
  total_spent       numeric,
  last_used         timestamptz,
  products          jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reads every customer's data, so bypassing RLS is only safe for admins.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  WITH gens AS (
    SELECT
      g.user_id,
      COALESCE(NULLIF(g.product_type, ''), 'unknown') AS pt,
      count(*)::bigint   AS generations,
      max(g.created_at)  AS last_used
    FROM public.ai_generations g
    GROUP BY g.user_id, COALESCE(NULLIF(g.product_type, ''), 'unknown')
  ),
  items AS (
    SELECT
      o.customer_id AS user_id,
      COALESCE(NULLIF(oi.details->>'product_type', ''), 'unknown') AS pt,
      max(oi.details->>'service_label')                            AS service_label,
      count(*)::bigint                                             AS ordered,
      COALESCE(sum((oi.details->>'unit_price')::numeric), 0)       AS spent
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE COALESCE((oi.details->>'is_ai_design')::boolean, false)
    GROUP BY o.customer_id, COALESCE(NULLIF(oi.details->>'product_type', ''), 'unknown')
  ),
  per_product AS (
    SELECT
      COALESCE(g.user_id, i.user_id)         AS user_id,
      COALESCE(g.pt, i.pt)                   AS pt,
      COALESCE(g.generations, 0)             AS generations,
      COALESCE(i.ordered, 0)                 AS ordered,
      COALESCE(i.spent, 0)                   AS spent,
      g.last_used,
      i.service_label
    FROM gens g
    FULL OUTER JOIN items i
      ON g.user_id = i.user_id AND g.pt = i.pt
  ),
  labeled AS (
    SELECT
      pp.*,
      -- Prefer the human label captured on the order, then the admin catalog, then the raw id.
      COALESCE(pp.service_label, ap.label, pp.pt) AS label
    FROM per_product pp
    LEFT JOIN public.ai_products ap ON ap.id = pp.pt
  )
  SELECT
    l.user_id,
    pr.display_name,
    pr.phone,
    sum(l.generations)::bigint AS total_generations,
    sum(l.ordered)::bigint     AS ordered_items,
    sum(l.spent)               AS total_spent,
    max(l.last_used)           AS last_used,
    jsonb_agg(
      jsonb_build_object(
        'product_type', l.pt,
        'label',        l.label,
        'generations',  l.generations,
        'ordered',      l.ordered,
        'spent',        l.spent
      )
      ORDER BY l.generations DESC, l.spent DESC
    ) AS products
  FROM labeled l
  LEFT JOIN public.profiles pr ON pr.user_id = l.user_id
  GROUP BY l.user_id, pr.display_name, pr.phone
  ORDER BY sum(l.generations) DESC, sum(l.spent) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_usage_by_customer() TO authenticated;
