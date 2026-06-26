import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Discount } from '@/hooks/useDiscounts';

/**
 * Returns a map of service_id -> best discount percentage
 * Includes global discounts applied to all services.
 */
export function useServiceDiscounts() {
  const [discountMap, setDiscountMap] = useState<Record<string, number>>({});
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('discounts' as never)
        .select('*')
        .eq('is_active', true);

      const active = ((data ?? []) as unknown as Discount[]).filter(d => {
        if (d.starts_at && d.starts_at > now) return false;
        if (d.ends_at && d.ends_at < now) return false;
        return true;
      });

      const map: Record<string, number> = {};
      let bestGlobal = 0;

      for (const d of active) {
        if (d.discount_type === 'global') {
          if (d.percentage > bestGlobal) bestGlobal = d.percentage;
        } else if (d.target_id) {
          const current = map[d.target_id] || 0;
          if (d.percentage > current) map[d.target_id] = d.percentage;
        }
      }

      setDiscountMap(map);
      setGlobalDiscount(bestGlobal);
      setLoading(false);
    };
    load();
  }, []);

  /** Get best discount for a service (direct match or global fallback) */
  const getDiscount = (serviceId: string) => {
    return discountMap[serviceId] || globalDiscount;
  };

  return { discountMap, globalDiscount, getDiscount, loading };
}
