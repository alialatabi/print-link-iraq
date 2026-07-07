-- Variant-tier product system — schema.
--
-- One sub-service (product) can carry a set of `service_variants` rows (its
-- sizes/shapes: 'A4', '6×4', 'وجهين'...). Each variant prices itself through
-- an admin-enumerated list of {qty, price, cost?, gift?} tiers stored as
-- jsonb — no pricing formulas; the admin types every orderable quantity.
-- Product-wide customer choices that don't change the size/die (stamp ink
-- color, bag color → dependent ink colors) live as `variant_attributes` jsonb
-- on the `services` row; see src/types/variants.ts for the exact shapes
-- (VariantTier, ServiceVariant, VariantAttribute, AttributeOption).
--
-- Backward-compatible & additive: a service with zero `service_variants` rows
-- keeps its existing legacy price/cost/min_quantity flow untouched (the
-- frontend treats `getVariants(id).length === 0` as "no variants").
--
-- The generated Supabase TS types don't know this table/column yet — client
-- queries cast with `as never` (see src/hooks/useVariants.ts), same pattern
-- already used for the AI catalog columns in useAiProducts.

-- ── service_variants table ───────────────────────────────────────────────────
CREATE TABLE public.service_variants (
  id text PRIMARY KEY,
  service_id text NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  label text NOT NULL,
  group_label text,
  size_label text,
  faces smallint,
  unit_label text,
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.service_variants IS
  'Sizes/shapes under a variant-tier service. Each row prices itself via an admin-enumerated tiers[] list (qty→price/cost/gift) — no formulas.';
COMMENT ON COLUMN public.service_variants.group_label IS
  'Optional first-level grouping the customer picks before the variant chip (e.g. stamp shape ''مستطيل'').';
COMMENT ON COLUMN public.service_variants.faces IS
  'Overrides services.faces for this specific variant (e.g. 2 for a ''وجهين'' variant). NULL = fall back to services.faces.';
COMMENT ON COLUMN public.service_variants.unit_label IS
  'Arabic unit noun for tier quantities (''دفتر'' for receipt books). NULL = quantities are pieces.';
COMMENT ON COLUMN public.service_variants.tiers IS
  'VariantTier[]: [{"qty":1000,"price":15000,"cost":0,"gift":0}, ...] — admin-typed, no formulas.';

CREATE INDEX idx_service_variants_service_id ON public.service_variants(service_id);

ALTER TABLE public.service_variants ENABLE ROW LEVEL SECURITY;

-- Mirrors the public.services policy idiom exactly (20260218234858): anon
-- browses the catalog freely, only admins can author it.
CREATE POLICY "Anyone can read service_variants" ON public.service_variants FOR SELECT USING (true);
CREATE POLICY "Admins manage service_variants" ON public.service_variants FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update service_variants" ON public.service_variants FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete service_variants" ON public.service_variants FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- ── services.variant_attributes ──────────────────────────────────────────────
-- Product-wide choices (ink color; bag color → dependent ink colors), ordered
-- array — VariantAttribute[]. NULL/absent = no product-wide attributes.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS variant_attributes jsonb;

COMMENT ON COLUMN public.services.variant_attributes IS
  'VariantAttribute[]: product-wide customer choices (stamp ink color; bag color with allows-restricted dependent ink colors). Array order is the picker cascade order. NULL = none.';

-- ── services.superseded_by ───────────────────────────────────────────────────
-- Set by the launch flip on old duplicated sub-services, pointing at the
-- consolidated variant-tier service that replaced them. Frontend pickers that
-- list print-disabled services too (upload flow, reseller new-order) exclude
-- superseded rows; the rows themselves stay for order-history label lookups.
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS superseded_by text;

COMMENT ON COLUMN public.services.superseded_by IS
  'Consolidated service id that replaced this old duplicated sub-service at the variant-tier flip. NULL = live service.';
