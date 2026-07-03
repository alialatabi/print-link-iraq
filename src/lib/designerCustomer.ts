import { supabase } from '@/integrations/supabase/client';
import type { OrderDetailsJson } from '@/types/db';

/**
 * Designer → customer contact helpers for the designer order view.
 *
 * Designers can't SELECT other users' profiles (RLS), so the authoritative account phone comes from
 * the SECURITY DEFINER RPC `get_customer_phone_for_designer` (see the matching migration), which
 * returns the phone ONLY to a designer assigned to one of that customer's orders. Until that
 * migration is deployed the RPC 404s — handled here by returning null so the caller falls back to
 * the phone carried in the order's own details JSON.
 */

/**
 * Best-effort: the customer's account phone via the assigned-designer RPC. Returns null on any
 * error (RPC not yet deployed, not assigned, no phone) so the UI degrades to the details fallback.
 */
export async function getCustomerPhoneForDesigner(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  try {
    // The RPC isn't in the generated types yet (same `as never` pattern as create_order_with_items).
    const { data, error } = await supabase.rpc('get_customer_phone_for_designer' as never, {
      _customer_id: customerId,
    } as never);
    if (error) return null;
    const raw = data as unknown; // rpc('…' as never) types data as never — widen before narrowing
    const phone = typeof raw === 'string' ? raw.trim() : '';
    return phone.length > 0 ? phone : null;
  } catch {
    return null;
  }
}

/**
 * Pure fallback: pull a callable phone out of an order's details JSON when the account phone isn't
 * available. Prefers the explicit delivery contact, then a generic contact / reseller shop phone.
 * Unit-tested.
 */
export function resolveDetailsPhone(details: OrderDetailsJson): string | null {
  const d = (details || {}) as Record<string, unknown>;
  for (const c of [d.delivery_phone, d.customer_phone, d.phone, d.shop_phone]) {
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return null;
}
