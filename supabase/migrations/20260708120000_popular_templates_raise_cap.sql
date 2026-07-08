-- The home page "قوالب خاصة للتخصيص" section moved from a top-8 strip to showing the
-- WHOLE catalog ranked most-ordered-first (see Index.tsx popular_templates call). The
-- original 20260702120000 migration capped limit_count at 24, sized for the old top-8
-- strip — with 38 live templates that cap silently truncated the catalog. Raise the cap
-- to 100: still a hard abuse ceiling on this SECURITY DEFINER function (public, anon can
-- call it), comfortably above the current and near-term catalog size.
--
-- Function body is otherwise identical to 20260702120000 (do not edit that file).

CREATE OR REPLACE FUNCTION public.popular_templates(limit_count int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  name text,
  preview_url text,
  service_type text,
  order_count int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.preview_url,
    t.service_type,
    COALESCE(c.cnt, 0)::int AS order_count
  FROM public.templates t
  LEFT JOIN (
    SELECT refs.template_id, COUNT(*) AS cnt
    FROM (
      SELECT o.template_id
        FROM public.orders o
       WHERE o.template_id IS NOT NULL
         AND o.status::text NOT IN ('draft', 'cancelled')
      UNION ALL
      SELECT oi.template_id
        FROM public.order_items oi
        JOIN public.orders po ON po.id = oi.order_id
       WHERE oi.template_id IS NOT NULL
         AND po.status::text NOT IN ('draft', 'cancelled')
    ) refs
    GROUP BY refs.template_id
  ) c ON c.template_id = t.id
  ORDER BY COALESCE(c.cnt, 0) DESC, t.created_at DESC
  LIMIT GREATEST(1, LEAST(limit_count, 100));
$$;

-- Public, read-only, non-identifying — safe to expose to anonymous visitors.
GRANT EXECUTE ON FUNCTION public.popular_templates(int) TO anon, authenticated;
