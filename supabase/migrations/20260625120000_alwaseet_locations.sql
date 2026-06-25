-- Al-Waseet (alwaseet-iq.net merchant API) location reference data: cities/محافظات + regions/مناطق.
-- Synced from the merchant API by the `sync-alwaseet-locations` edge function and used to drive
-- cascading محافظة → منطقة dropdowns in registration (CompleteProfile) and the delivery/profile forms.
-- We keep Al-Waseet's own integer ids as the PKs so a future "create delivery order" call can pass
-- city_id/region_id directly.

CREATE TABLE IF NOT EXISTS public.alwaseet_cities (
  id integer PRIMARY KEY,            -- Al-Waseet city id
  name text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alwaseet_regions (
  id integer PRIMARY KEY,            -- Al-Waseet region id
  city_id integer NOT NULL REFERENCES public.alwaseet_cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alwaseet_regions_city_idx ON public.alwaseet_regions (city_id);

ALTER TABLE public.alwaseet_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alwaseet_regions ENABLE ROW LEVEL SECURITY;

-- Public, non-sensitive reference data — the address form may render before auth completes, so allow
-- read for everyone (incl. anon). Writes happen only via the service-role sync fn (bypasses RLS).
DROP POLICY IF EXISTS "Anyone reads alwaseet cities" ON public.alwaseet_cities;
DROP POLICY IF EXISTS "Anyone reads alwaseet regions" ON public.alwaseet_regions;
CREATE POLICY "Anyone reads alwaseet cities" ON public.alwaseet_cities FOR SELECT USING (true);
CREATE POLICY "Anyone reads alwaseet regions" ON public.alwaseet_regions FOR SELECT USING (true);

-- Persist the chosen Al-Waseet ids alongside the existing display names (kept for back-compat:
-- orders/saved_addresses still read province/area text).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS province_id integer,
  ADD COLUMN IF NOT EXISTS area_id integer;

ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS province_id integer,
  ADD COLUMN IF NOT EXISTS area_id integer;
