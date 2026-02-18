
-- Add new address columns to profiles
ALTER TABLE public.profiles ADD COLUMN province text;
ALTER TABLE public.profiles ADD COLUMN area text;
ALTER TABLE public.profiles ADD COLUMN landmark text;

-- Migrate existing address data to province (best effort)
UPDATE public.profiles SET province = address WHERE address IS NOT NULL AND address != '';

-- Drop old address column
ALTER TABLE public.profiles DROP COLUMN address;
