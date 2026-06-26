-- H2 (Security Audit): Customers could self-approve / self-deliver orders.
--
-- The orders UPDATE policy authorizes the row (own order / assigned designer / admin)
-- but has no WITH CHECK or status-transition guard, so a customer could PATCH their own
-- order straight to 'printed' / 'delivered' / 'print_ready', skipping the workflow.
--
-- Fix: a BEFORE UPDATE trigger that constrains which target statuses a *plain customer*
-- may set. Staff-class roles (admin / designer / reseller) and trusted backend calls
-- (service role, where auth.uid() IS NULL) are unrestricted so existing flows keep working.
--
-- Legitimate plain-customer transitions in the app today:
--   draft -> submitted          (checkout / order creation)
--   waiting_approval -> approved (DeliveryAddressPage: customer accepts the design)
--   <active> -> cancelled        (OrderTracking: customer cancels)
-- Everything else (assigned / design_uploaded / waiting_approval / print_ready /
-- printed / delivered) is a staff action and is rejected for plain customers.

CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Status not changing → nothing to guard (details/payment/etc. updates pass freely).
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Trusted backend (service role / definer context) has no JWT user.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Staff-class roles manage the full workflow.
  IF public.has_role(v_uid, 'admin')
     OR public.has_role(v_uid, 'designer')
     OR public.has_role(v_uid, 'reseller') THEN
    RETURN NEW;
  END IF;

  -- Plain customer on their own order: only the customer-driven transitions.
  IF v_uid = OLD.customer_id
     AND NEW.status IN ('draft', 'submitted', 'approved', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Order status transition % -> % is not allowed for this account',
    OLD.status, NEW.status
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_status_transition ON public.orders;
CREATE TRIGGER enforce_order_status_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_status_transition();
