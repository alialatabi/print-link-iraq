
-- Drop existing foreign key and recreate with ON DELETE SET NULL
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_template_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_template_id_fkey 
  FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;
