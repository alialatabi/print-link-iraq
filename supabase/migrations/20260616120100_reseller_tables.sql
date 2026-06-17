-- B2B reseller (print shops / offices) support tables.
-- Reseller orders themselves reuse the existing `orders` table (customer_id = reseller's
-- user id, details.order_type = 'reseller'), so they inherit the existing orders RLS.

-- ── Reseller business profile ────────────────────────────────────────────────
CREATE TABLE public.resellers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  shop_phone TEXT NOT NULL,
  shop_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resellers read own profile or admin"
  ON public.resellers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert resellers"
  ON public.resellers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update resellers"
  ON public.resellers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete resellers"
  ON public.resellers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_resellers_updated_at
  BEFORE UPDATE ON public.resellers FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ── Reseller pricing overrides ───────────────────────────────────────────────
-- A single flexible rule table. Resolution = most specific wins:
--   1. (reseller_id set, service_id set)
--   2. (reseller_id set, service_id NULL)   -> reseller-wide
--   3. (reseller_id NULL, service_id set)   -> product-wide (all resellers)
--   4. (reseller_id NULL, service_id NULL)  -> global default (seeded 20%)
-- price_type: 'percent' (value = 0..100 discount off base) | 'fixed' (value = price per min_quantity)
CREATE TABLE public.reseller_price_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES public.services(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL CHECK (price_type IN ('percent', 'fixed')),
  value INTEGER NOT NULL CHECK (value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce one rule per (reseller, service) combination, treating NULLs as a key
-- so the global default and product-wide / reseller-wide rules stay unique.
CREATE UNIQUE INDEX reseller_price_overrides_unique
  ON public.reseller_price_overrides (
    COALESCE(reseller_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(service_id, '__ALL__')
  );

ALTER TABLE public.reseller_price_overrides ENABLE ROW LEVEL SECURITY;

-- Resellers may read global + product-wide rules and their own reseller-specific
-- rules (needed to compute their prices). Admins read everything.
CREATE POLICY "Read relevant reseller pricing"
  ON public.reseller_price_overrides FOR SELECT
  TO authenticated
  USING (
    reseller_id IS NULL
    OR reseller_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins insert reseller pricing"
  ON public.reseller_price_overrides FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update reseller pricing"
  ON public.reseller_price_overrides FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete reseller pricing"
  ON public.reseller_price_overrides FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reseller_price_overrides_updated_at
  BEFORE UPDATE ON public.reseller_price_overrides FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Seed the global default reseller discount: 20% off every product.
INSERT INTO public.reseller_price_overrides (reseller_id, service_id, price_type, value)
VALUES (NULL, NULL, 'percent', 20);
