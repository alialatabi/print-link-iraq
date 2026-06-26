import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Discount {
  id: string;
  discount_type: 'global' | 'parent_service' | 'sub_service';
  target_id: string | null;
  percentage: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  percentage: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function useDiscounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('discounts' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setDiscounts((data || []) as unknown as Discount[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { discounts, loading, reload: load };
}

export function useCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('coupons' as any)
      .select('*')
      .order('created_at', { ascending: false });
    setCoupons((data || []) as unknown as Coupon[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { coupons, loading, reload: load };
}

/**
 * Returns the best applicable discount percentage for a given service.
 * Checks: sub_service match → parent_service match → global discount
 * Only considers active discounts within their date range.
 */
export function useActiveDiscount(serviceId?: string, parentServiceId?: string | null) {
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountLabel, setDiscountLabel] = useState('');

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('discounts' as any)
        .select('*')
        .eq('is_active', true) as any;

      const active = ((data || []) as Discount[]).filter(d => {
        if (d.starts_at && d.starts_at > now) return false;
        if (d.ends_at && d.ends_at < now) return false;
        return true;
      });

      // Priority: sub_service > parent_service > global
      let best = 0;
      let label = '';

      for (const d of active) {
        if (d.discount_type === 'sub_service' && d.target_id === serviceId && d.percentage > best) {
          best = d.percentage; label = `خصم ${d.percentage}%`;
        }
      }
      if (!best) {
        for (const d of active) {
          if (d.discount_type === 'parent_service' && d.target_id === parentServiceId && d.percentage > best) {
            best = d.percentage; label = `خصم ${d.percentage}%`;
          }
        }
      }
      if (!best) {
        for (const d of active) {
          if (d.discount_type === 'global' && d.percentage > best) {
            best = d.percentage; label = `خصم عام ${d.percentage}%`;
          }
        }
      }

      setDiscountPercent(best);
      setDiscountLabel(label);
    };
    load();
  }, [serviceId, parentServiceId]);

  return { discountPercent, discountLabel };
}

/**
 * Validate a coupon code. Returns the coupon if valid, null otherwise.
 */
export async function validateCoupon(code: string): Promise<Coupon | null> {
  try {
    const { data, error } = await supabase.functions.invoke('validate-coupon', {
      body: { action: 'validate', code },
    });
    if (error || !data?.valid) return null;
    return data.coupon as Coupon;
  } catch {
    return null;
  }
}

/**
 * Consume one use of a coupon, tied to a real order the caller owns. The DB function
 * records the redemption once per order and bumps used_count atomically under max_uses,
 * so it cannot be drained or over-run from the client (H1).
 */
export async function redeemCoupon(couponId: string, orderId: string) {
  await supabase.rpc('redeem_coupon' as any, { p_coupon_id: couponId, p_order_id: orderId });
}
