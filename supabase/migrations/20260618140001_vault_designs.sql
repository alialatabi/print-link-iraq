-- Design Vault ("خزنة التصاميم"): per-customer saved designs.
-- The vault page also aggregates ordered designs derived from existing tables
-- (uploaded ready designs from orders.details, designer-finished designs from public.designs),
-- so this table only stores designs the customer explicitly SAVED — chiefly AI designs that
-- were generated and kept without (yet) placing an order. The image itself lives in the
-- existing public `order-attachments` bucket under `vault/<userId>/...`.

CREATE TABLE IF NOT EXISTS public.vault_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'ai',   -- ai | uploaded | designer
  image_url text NOT NULL,             -- public URL in the order-attachments bucket
  service_type text,
  label text,
  brief text,
  ai_prompt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_designs_user_created_idx
  ON public.vault_designs (user_id, created_at DESC);

ALTER TABLE public.vault_designs ENABLE ROW LEVEL SECURITY;

-- Owners (and admins) read their own saved designs.
CREATE POLICY "Users read own vault designs"
  ON public.vault_designs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Owners save their own designs.
CREATE POLICY "Users insert own vault designs"
  ON public.vault_designs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owners (and admins) remove saved designs.
CREATE POLICY "Users delete own vault designs"
  ON public.vault_designs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
