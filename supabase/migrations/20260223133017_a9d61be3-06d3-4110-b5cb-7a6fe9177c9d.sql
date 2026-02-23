
-- Fix existing stuck items: update submitted items to assigned for assigned orders
UPDATE public.order_items oi
SET status = 'assigned'
FROM public.orders o
WHERE oi.order_id = o.id
  AND o.status IN ('assigned', 'design_uploaded', 'waiting_approval', 'approved', 'print_ready', 'printed', 'delivered')
  AND oi.status = 'submitted';
