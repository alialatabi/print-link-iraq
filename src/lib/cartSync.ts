/**
 * Resilient server I/O for the account-synced cart (public.carts).
 *
 * The `carts` table is created by a migration the orchestrator applies later, so it is absent from
 * the generated Supabase types (and from prod until applied). We therefore cast the table name with
 * `as never` — the established pattern for not-yet-typed tables (see device_tokens in src/lib/push.ts,
 * vault_designs in src/lib/designVault.ts) — and make EVERY call swallow failures silently. Supabase
 * reports a missing table (or a 404) in the returned `{ error }` rather than by throwing, so we both
 * check that field AND wrap in try/catch: pre-migration, the cart simply behaves as if the server
 * copy were empty, and cart UX is never blocked or toasted on a network/DB failure.
 */
import { supabase } from '@/integrations/supabase/client';
import type { CartItem } from '@/contexts/CartContext';

/**
 * Read the signed-in user's server cart. Returns the raw (untrusted) items payload, or [] on any
 * failure — including the table not yet existing. The caller MUST sanitize the result before use.
 */
export async function loadServerCart(userId: string): Promise<unknown> {
  try {
    const { data, error } = await supabase
      .from('carts' as never)
      .select('items')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return [];
    return (data as { items?: unknown }).items ?? [];
  } catch {
    return [];
  }
}

/** Upsert the full cart (fire-and-forget). Silently ignores every failure, incl. pre-migration. */
export async function saveServerCart(userId: string, items: CartItem[]): Promise<void> {
  try {
    await supabase
      .from('carts' as never)
      .upsert(
        { user_id: userId, items, updated_at: new Date().toISOString() } as never,
        { onConflict: 'user_id' },
      );
  } catch {
    /* best-effort: cart sync must never break the UX */
  }
}

/** Delete the server cart row (e.g. after a successful order). Silently ignores every failure. */
export async function deleteServerCart(userId: string): Promise<void> {
  try {
    await supabase.from('carts' as never).delete().eq('user_id', userId);
  } catch {
    /* best-effort */
  }
}
