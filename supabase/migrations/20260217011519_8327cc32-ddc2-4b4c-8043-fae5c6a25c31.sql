
-- Add text_fields column to templates for storing field positions
-- Each field: { key, label, x, y, fontSize, fontColor, fontWeight, textAlign, maxWidth }
ALTER TABLE public.templates
ADD COLUMN text_fields JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.templates.text_fields IS 'Array of text field definitions with position/style for canvas rendering';
