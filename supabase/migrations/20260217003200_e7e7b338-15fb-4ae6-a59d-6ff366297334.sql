-- Add price column to templates table (in Iraqi Dinar)
ALTER TABLE public.templates ADD COLUMN price INTEGER DEFAULT NULL;