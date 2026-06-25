-- AI Designs admin gallery: persist the generated image for EVERY generation.
--
-- Until now `ai_generations` logged only the brief/prompt/cost; the image itself was uploaded
-- to the public `order-attachments` bucket only if the customer ordered, saved-to-vault, or
-- requested an edit. To let admins review *all* AI designs customers generate (ordered or not),
-- the edge function now uploads each generated image to `order-attachments/ai-generations/<userId>/`
-- and records its public URL here.

ALTER TABLE public.ai_generations
  ADD COLUMN IF NOT EXISTS image_url text;

COMMENT ON COLUMN public.ai_generations.image_url IS
  'Public URL (order-attachments bucket) of the generated design image, stored at generation time so admins can review every AI design. NULL for legacy rows generated before this column existed.';

-- Admins read the whole gallery filtered by recency; the existing
-- (user_id, created_at DESC) index already serves per-user reads, add a global recency index
-- for the admin "newest first" gallery scan.
CREATE INDEX IF NOT EXISTS ai_generations_created_idx
  ON public.ai_generations (created_at DESC);

-- NOTE: the existing SELECT policy ("Users read own ai generations") already grants admins
-- (public.has_role(auth.uid(),'admin')) read access to every row, so no new policy is needed.
