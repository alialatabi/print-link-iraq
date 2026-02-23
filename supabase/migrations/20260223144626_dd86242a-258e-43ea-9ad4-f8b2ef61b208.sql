
-- Add parent_id to services for hierarchical structure
ALTER TABLE public.services ADD COLUMN parent_id text REFERENCES public.services(id) ON DELETE CASCADE DEFAULT NULL;

-- Parent services won't need price/cost (they're categories)
-- Sub-services (with parent_id) will have price/cost
-- Templates already link via service_type to sub-services
