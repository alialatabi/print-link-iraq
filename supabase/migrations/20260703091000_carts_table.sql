-- Server-synced shopping cart: one row per user mirroring the client's localStorage cart
-- (key 'matbaati_cart'). The cart stays localStorage-first for instant UX; the client fetches +
-- merges this row once on login (local wins on conflict) and debounces an upsert of the full items
-- array on every change. This lets a customer's cart survive a device switch and lets the business
-- see abandoned carts server-side (read via the service role, which bypasses RLS).

CREATE TABLE IF NOT EXISTS public.carts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,   -- array of CartItem (templateId, quantity, unitPrice, ...)
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- Owner-only: a user may select/insert/update/delete ONLY their own cart row. The abandoned-cart
-- reporting runs under the service role (bypasses RLS), so no staff read policy is needed here.
DROP POLICY IF EXISTS "Users manage own cart" ON public.carts;
CREATE POLICY "Users manage own cart"
  ON public.carts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
