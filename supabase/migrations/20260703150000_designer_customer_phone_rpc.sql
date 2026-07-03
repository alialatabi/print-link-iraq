-- Designer click-to-call: let an assigned designer read the ACCOUNT phone of a customer whose
-- order they are working on (designer order view surfaces it as a tel: link for ALL order types).
--
-- Designers have NO direct SELECT on other users' profiles (that is exactly why
-- get_customer_names_for_designer, 20260222005001, exists as a SECURITY DEFINER function that only
-- leaks the display_name). This mirrors that function precisely but returns the phone, and gates it
-- the same way: the row is returned ONLY when the caller (auth.uid()) is the designer_id on some
-- order belonging to that customer. Any other caller gets NULL — a designer can never enumerate
-- arbitrary phones, only reach the customers they are actively assigned to.
--
-- Deploy note: FILE ONLY — safe to ship the frontend first. The client wrapper
-- (getCustomerPhoneForDesigner) swallows the "function does not exist" error and falls back to the
-- order's delivery phone until this lands.

CREATE OR REPLACE FUNCTION public.get_customer_phone_for_designer(_customer_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.phone
  FROM public.profiles p
  WHERE p.user_id = _customer_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.customer_id = p.user_id
        AND o.designer_id = auth.uid()
    )
$$;

-- authenticated-only (same rationale as heartbeat_increment/create_order_with_items): Supabase
-- grants EXECUTE to PUBLIC and anon by default, so revoke both explicitly, then grant only
-- authenticated. A logged-out visitor can never call this.
REVOKE ALL ON FUNCTION public.get_customer_phone_for_designer(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_customer_phone_for_designer(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_customer_phone_for_designer(uuid) TO authenticated;
