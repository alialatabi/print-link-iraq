-- Real AI usage cost tracking + date-filtered per-customer rollup.
--
-- 1) Capture the real OpenAI cost per generation. The edge function computes it from the token
--    usage returned by the text + image calls × configurable rate secrets, and stores both the
--    USD cost and its IQD conversion (rate locked in at generation time) plus the raw usage.
-- 2) Extend ai_usage_by_customer() with an optional [p_from, p_to) date window and cost columns.

ALTER TABLE public.ai_generations
  ADD COLUMN IF NOT EXISTS cost_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_iqd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage    jsonb;

COMMENT ON COLUMN public.ai_generations.cost_usd IS 'Real OpenAI cost (USD) for this generation, from captured token usage × configurable rates.';
COMMENT ON COLUMN public.ai_generations.cost_iqd IS 'cost_usd converted to IQD at the USD→IQD rate in effect when the design was generated.';
COMMENT ON COLUMN public.ai_generations.usage    IS 'Raw token usage from the OpenAI text + image responses (audit trail for the cost).';

-- Return shape changes (new params + cost columns) → must drop the old signature first.
DROP FUNCTION IF EXISTS public.ai_usage_by_customer();

CREATE OR REPLACE FUNCTION public.ai_usage_by_customer(
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL   -- exclusive upper bound; NULL on either side = open-ended
)
RETURNS TABLE (
  user_id           uuid,
  display_name      text,
  phone             text,
  total_generations bigint,
  ordered_items     bigint,
  total_spent       numeric,   -- AI design fees charged (IQD)
  total_cost_usd    numeric,   -- real OpenAI cost (USD)
  total_cost_iqd    numeric,   -- real OpenAI cost (IQD)
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
      count(*)::bigint              AS generations,
      COALESCE(sum(g.cost_usd), 0)  AS cost_usd,
      COALESCE(sum(g.cost_iqd), 0)  AS cost_iqd,
      max(g.created_at)             AS last_used
    FROM public.ai_generations g
    WHERE (p_from IS NULL OR g.created_at >= p_from)
      AND (p_to   IS NULL OR g.created_at <  p_to)
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
      AND (p_from IS NULL OR oi.created_at >= p_from)
      AND (p_to   IS NULL OR oi.created_at <  p_to)
    GROUP BY o.customer_id, COALESCE(NULLIF(oi.details->>'product_type', ''), 'unknown')
  ),
  per_product AS (
    SELECT
      COALESCE(g.user_id, i.user_id) AS user_id,
      COALESCE(g.pt, i.pt)           AS pt,
      COALESCE(g.generations, 0)     AS generations,
      COALESCE(g.cost_usd, 0)        AS cost_usd,
      COALESCE(g.cost_iqd, 0)        AS cost_iqd,
      COALESCE(i.ordered, 0)         AS ordered,
      COALESCE(i.spent, 0)           AS spent,
      g.last_used,
      i.service_label
    FROM gens g
    FULL OUTER JOIN items i
      ON g.user_id = i.user_id AND g.pt = i.pt
  ),
  labeled AS (
    SELECT
      pp.*,
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
    sum(l.cost_usd)            AS total_cost_usd,
    sum(l.cost_iqd)            AS total_cost_iqd,
    max(l.last_used)           AS last_used,
    jsonb_agg(
      jsonb_build_object(
        'product_type', l.pt,
        'label',        l.label,
        'generations',  l.generations,
        'cost_usd',     l.cost_usd,
        'cost_iqd',     l.cost_iqd,
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

GRANT EXECUTE ON FUNCTION public.ai_usage_by_customer(timestamptz, timestamptz) TO authenticated;
