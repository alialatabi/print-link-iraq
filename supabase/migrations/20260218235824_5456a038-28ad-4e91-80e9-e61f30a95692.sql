
-- Convert specialization from text to text array
ALTER TABLE public.templates ADD COLUMN specializations text[] DEFAULT '{}';

-- Migrate existing data
UPDATE public.templates SET specializations = ARRAY[specialization] WHERE specialization IS NOT NULL AND specialization != '';

-- Drop old column
ALTER TABLE public.templates DROP COLUMN specialization;
