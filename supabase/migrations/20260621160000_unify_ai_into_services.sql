-- Unify the AI-design product catalog into the services tree ("one catalog").
-- AI design becomes a capability of a (sub-)service: each service row can be flagged
-- ai_enabled and carry its own AI config (canvas, size/orientation options or a free-text
-- size, directives, design fee). The AI-design page is generated from ai_enabled services.
-- print_enabled controls whether a row appears in the printed-services browse, so AI-only
-- products don't create dead-end print pages.

-- 1) AI capability + channel flags on services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS ai_enabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_fee          integer NOT NULL DEFAULT 0,    -- flat IQD design fee
  ADD COLUMN IF NOT EXISTS ai_canvas       text,                          -- 1024x1024 | 1536x1024 | 1024x1536
  ADD COLUMN IF NOT EXISTS ai_size_label   text,
  ADD COLUMN IF NOT EXISTS ai_option_label text,
  ADD COLUMN IF NOT EXISTS ai_options      jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_custom_size  jsonb,
  ADD COLUMN IF NOT EXISTS ai_directives   text,
  ADD COLUMN IF NOT EXISTS print_enabled   boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.services.ai_enabled IS 'Product is offered on the AI-design page';
COMMENT ON COLUMN public.services.print_enabled IS 'Product is shown in the printed-services browse';

-- 2) Home category for migrated AI products (admin can re-drag them under other parents).
INSERT INTO public.services
  (id, label, icon, description, sort_order, price, cost, parent_id, print_enabled, ai_enabled)
VALUES
  ('ai_designs', 'تصاميم الذكاء الاصطناعي', '🎨', '', 9000, 0, 0, NULL, false, false)
ON CONFLICT (id) DO NOTHING;

-- 3) Copy every ai_products row into services as an AI-only sub-service.
--    Ids are namespaced (aip_*) so they never collide with existing service slugs
--    (e.g. the seeded parents flyer / menu / letterhead). print_enabled=false keeps them
--    out of the print browse; ai_enabled mirrors the old `active` flag.
INSERT INTO public.services
  (id, label, icon, description, sort_order, price, cost, parent_id, completion_days, min_quantity, cellophane_type,
   ai_enabled, ai_fee, ai_canvas, ai_size_label, ai_option_label, ai_options, ai_custom_size, ai_directives, print_enabled)
SELECT
  'aip_' || p.id, p.label, '🎨', '', 9000 + p.sort_order, 0, 0, 'ai_designs', 0, 1, 'none',
  p.active, COALESCE(p.price, 0), p.canvas, p.size_label, p.option_label,
  COALESCE(p.options, '[]'::jsonb), p.custom_size, p.directives, false
FROM public.ai_products p
ON CONFLICT (id) DO NOTHING;

-- 4) Keep ai_products for rollback; drop in a later migration once verified.
COMMENT ON TABLE public.ai_products IS 'DEPRECATED — folded into services.ai_* (2026-06-21). Drop after verification.';
