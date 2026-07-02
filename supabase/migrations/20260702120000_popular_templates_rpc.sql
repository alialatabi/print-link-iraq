-- "Popular templates" strip on the home page: the client used to download EVERY template plus
-- EVERY order row and count client-side (Index.tsx loadPopular) — unbounded, grew with each
-- order ever taken. Replace with a server-side top-N, same pattern as recent_order_activity:
-- orders RLS blocks public reads, so this runs as SECURITY DEFINER and returns only the
-- non-identifying template columns the home cards render (no customer data).
--
-- Template references live in BOTH places (see 20260216231011 / 20260223131201):
--   orders.template_id       — legacy single-template orders
--   order_items.template_id  — multi-item cart orders
-- Both are counted; draft and cancelled orders are excluded. templates has no is_active
-- flag — every row is a live, admin-managed template, so all rows are eligible and
-- zero-order templates fill the tail (newest first), matching the old client behavior.

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
  LIMIT GREATEST(1, LEAST(limit_count, 24));
$$;

-- Public, read-only, non-identifying — safe to expose to anonymous visitors.
GRANT EXECUTE ON FUNCTION public.popular_templates(int) TO anon, authenticated;
