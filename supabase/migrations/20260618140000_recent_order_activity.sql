-- Social-proof ticker on the home page: expose the LATEST orders anonymized (product + province +
-- time, NO customer names) to anonymous visitors. `orders` RLS blocks public reads, so this runs as
-- SECURITY DEFINER and returns only non-identifying columns.

CREATE OR REPLACE FUNCTION public.recent_order_activity(p_limit int DEFAULT 10)
RETURNS TABLE (
  product text,      -- service_type slug (e.g. 'business_card') or an Arabic label, mapped client-side
  province text,     -- city/province only (no name)
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      t.service_type::text,
      (SELECT COALESCE(oi.details->>'service_label', it.service_type::text)
         FROM public.order_items oi
         LEFT JOIN public.templates it ON it.id = oi.template_id
        WHERE oi.order_id = o.id
        ORDER BY oi.created_at ASC
        LIMIT 1),
      o.details->>'service_label'
    ) AS product,
    COALESCE(NULLIF(o.details->>'delivery_province', ''), p.province) AS province,
    o.created_at
  FROM public.orders o
  LEFT JOIN public.templates t ON t.id = o.template_id
  LEFT JOIN public.profiles p ON p.user_id = o.customer_id
  WHERE o.status::text <> 'draft'
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 30));
$$;

-- Public, read-only, non-identifying — safe to expose to anonymous visitors.
GRANT EXECUTE ON FUNCTION public.recent_order_activity(int) TO anon, authenticated;
