-- The per-template description is deprecated: descriptions now live on the sub-service
-- (services.description) and are shared by every template under that service. Clear the
-- stale text left over on individual templates so nothing dangling can resurface.
-- The column itself is kept (still present in the generated types) but always NULL going forward.

UPDATE public.templates
SET description = NULL
WHERE description IS NOT NULL;
