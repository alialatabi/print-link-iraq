-- Remove sensitive customer contact columns from orders table
-- Customer info should be fetched from profiles table with proper RLS

ALTER TABLE public.orders 
  DROP COLUMN IF EXISTS customer_name,
  DROP COLUMN IF EXISTS customer_phone;