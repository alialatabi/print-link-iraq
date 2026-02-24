
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS preview_urls text[] DEFAULT '{}';

-- Migrate existing preview_url to preview_urls array
UPDATE public.templates 
SET preview_urls = ARRAY[preview_url] 
WHERE preview_url IS NOT NULL AND (preview_urls IS NULL OR preview_urls = '{}');
