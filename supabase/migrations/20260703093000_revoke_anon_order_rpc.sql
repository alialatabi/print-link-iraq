-- Supabase default privileges grant EXECUTE on new functions to anon directly (not via
-- PUBLIC), so the REVOKE FROM PUBLIC in 20260703090000 didn't cover it. The function's
-- first-line auth.uid() guard already rejects anon calls; this just closes the door at
-- the grant layer too.
REVOKE EXECUTE ON FUNCTION public.create_order_with_items(uuid, uuid, jsonb, jsonb) FROM anon;
