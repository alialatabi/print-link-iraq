/**
 * Service layer — Coupons domain.
 *
 * Thin wrapper around the `validate-coupon` edge function call used by MyCoupons.
 * All toast / loading / copy-to-clipboard logic stays in the component.
 */
import { supabase } from '@/integrations/supabase/client';

/** Shape returned by the validate-coupon edge function's `list` action. */
export interface CouponRow {
  id: string;
  code: string;
  percentage: number;
  expires_at: string | null;
}

/**
 * Fetch all available coupons for the current user via the validate-coupon edge function.
 * Returns `{ data: { coupons: CouponRow[] } | null, error }`.
 */
export function listCoupons() {
  return supabase.functions.invoke('validate-coupon', {
    body: { action: 'list' },
  });
}
