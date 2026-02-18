
-- Add specialization column to templates
ALTER TABLE public.templates ADD COLUMN specialization text;

-- Create index for faster filtering
CREATE INDEX idx_templates_specialization ON public.templates (service_type, specialization);
