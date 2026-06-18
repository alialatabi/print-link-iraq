-- AI Design feature: log every AI generation for per-user daily rate limiting + analytics.
-- The generated image itself is NOT stored here; on accept it is uploaded to the existing
-- public `order-attachments` bucket and referenced from order_items.details.attachment_urls
-- (mirroring the normal checkout flow), so no new storage bucket is needed.

CREATE TABLE public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief text,
  product_type text,
  size text,
  rewritten_prompt text,
  model text,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup for the "how many did this user generate today" rate-limit query.
CREATE INDEX ai_generations_user_created_idx
  ON public.ai_generations (user_id, created_at DESC);

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

-- Owners (and admins) may read their own generation history. Inserts happen only from the
-- edge function via the service-role key, which bypasses RLS — so no INSERT policy is needed.
CREATE POLICY "Users read own ai generations"
  ON public.ai_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
