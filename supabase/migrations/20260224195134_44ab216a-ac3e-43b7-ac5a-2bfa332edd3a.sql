ALTER TABLE public.services ADD COLUMN IF NOT EXISTS min_quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS cellophane_type text NOT NULL DEFAULT 'none';
COMMENT ON COLUMN public.services.cellophane_type IS 'none, matte, glossy, both';