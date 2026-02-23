
-- Create order_items table for multi-item cart orders
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.templates(id),
  details jsonb DEFAULT '{}',
  status public.order_status DEFAULT 'submitted',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS: Read - customer, designer, admin (via parent order)
CREATE POLICY "Read order items" ON public.order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND (o.customer_id = auth.uid() OR o.designer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- RLS: Insert - customer creates items for own orders
CREATE POLICY "Customer creates order items" ON public.order_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND o.customer_id = auth.uid()
  )
);

-- RLS: Update - customer, designer, admin
CREATE POLICY "Update order items" ON public.order_items
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND (o.customer_id = auth.uid() OR o.designer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- RLS: Delete - admin or customer for draft orders
CREATE POLICY "Delete order items" ON public.order_items
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR (o.customer_id = auth.uid() AND o.status = 'draft'::order_status))
  )
);

-- Deny anonymous access
CREATE POLICY "Deny anon order items" ON public.order_items
AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

-- Add order_item_id to designs for per-item design tracking
ALTER TABLE public.designs ADD COLUMN order_item_id uuid REFERENCES public.order_items(id);

-- Trigger: when order becomes 'assigned', sync all items to 'assigned'
-- When order is cancelled, cancel all items
CREATE OR REPLACE FUNCTION public.sync_items_on_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'assigned' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.order_items SET status = 'assigned' WHERE order_id = NEW.id AND status = 'submitted';
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.order_items SET status = 'cancelled' WHERE order_id = NEW.id AND status != 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_items_on_order_status_change
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_items_on_order_status();

-- Enable realtime for order_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
