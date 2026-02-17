-- 1. Fix profiles: restrict read to own profile + admins/designers (for order context)
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'designer'::app_role)
);

-- 2. Add INSERT policy for profiles (for trigger-based creation)
CREATE POLICY "System inserts profiles"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Add DELETE policy for profiles (own profile + admin)
CREATE POLICY "Users delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 4. Add DELETE policy for designs (designer of order + admin)
CREATE POLICY "Designers delete own designs"
ON public.designs
FOR DELETE
USING (
  (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = designs.order_id
    AND orders.designer_id = auth.uid()
  ))
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- 5. Add DELETE policy for orders (customer draft only + admin)
CREATE POLICY "Customers delete draft orders"
ON public.orders
FOR DELETE
USING (
  (auth.uid() = customer_id AND status = 'draft')
  OR has_role(auth.uid(), 'admin'::app_role)
);