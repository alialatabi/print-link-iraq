
-- Drop the overly permissive policy if it exists
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

-- Ensure the correct restrictive policy exists
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Allow designers to read profiles of customers whose orders are assigned to them
CREATE POLICY "Designers read assigned customer profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.designer_id = auth.uid()
        AND orders.customer_id = profiles.user_id
    )
  );
