
-- Discounts table: service-level or global discounts
CREATE TABLE public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_type text NOT NULL DEFAULT 'global' CHECK (discount_type IN ('global', 'parent_service', 'sub_service')),
  target_id text DEFAULT NULL, -- service id (null for global)
  percentage integer NOT NULL DEFAULT 0 CHECK (percentage > 0 AND percentage <= 100),
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone DEFAULT now(),
  ends_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Admins manage discounts
CREATE POLICY "Admins manage discounts" ON public.discounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Anyone can read active discounts
CREATE POLICY "Anyone can read active discounts" ON public.discounts FOR SELECT USING (is_active = true);

-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  percentage integer NOT NULL DEFAULT 0 CHECK (percentage > 0 AND percentage <= 100),
  max_uses integer DEFAULT NULL, -- null = unlimited
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Admins manage coupons
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Anyone can read active coupons (for validation)
CREATE POLICY "Anyone can read coupons" ON public.coupons FOR SELECT USING (true);
