import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { DbService } from '@/hooks/useServices';

export interface ResellerPriceOverride {
  id: string;
  reseller_id: string | null;
  service_id: string | null;
  price_type: 'percent' | 'fixed';
  value: number;
}

export interface ResolvedResellerPrice {
  /** Discounted unit price per min_quantity (what the reseller pays). */
  unitPrice: number;
  /** Original customer-facing unit price per min_quantity. */
  originalUnitPrice: number;
  /** Source rule type that won the resolution. */
  type: 'percent' | 'fixed';
  /** Effective discount percent vs the original price (rounded), for display. */
  discountPercent: number;
}

/**
 * Resolve the most specific override for a (reseller, service) pair.
 * Specificity: reseller+service > reseller-wide > product-wide > global default.
 */
export function resolveOverride(
  overrides: ResellerPriceOverride[],
  resellerId: string | null,
  serviceId: string,
): ResellerPriceOverride | null {
  const score = (o: ResellerPriceOverride): number => {
    let s = 0;
    if (o.reseller_id && o.reseller_id === resellerId) s += 2;
    else if (o.reseller_id) return -1; // belongs to another reseller — ignore
    if (o.service_id === serviceId) s += 1;
    else if (o.service_id) return -1; // belongs to another product — ignore
    return s;
  };
  let best: ResellerPriceOverride | null = null;
  let bestScore = -1;
  for (const o of overrides) {
    const s = score(o);
    if (s > bestScore) {
      bestScore = s;
      best = o;
    }
  }
  return best;
}

export function computeResellerPrice(
  service: Pick<DbService, 'id' | 'price'>,
  overrides: ResellerPriceOverride[],
  resellerId: string | null,
): ResolvedResellerPrice {
  const base = service.price || 0;
  const rule = resolveOverride(overrides, resellerId, service.id);

  if (!rule) {
    return { unitPrice: base, originalUnitPrice: base, type: 'percent', discountPercent: 0 };
  }

  if (rule.price_type === 'fixed') {
    const unitPrice = rule.value;
    const discountPercent = base > 0 ? Math.max(0, Math.round((1 - unitPrice / base) * 100)) : 0;
    return { unitPrice, originalUnitPrice: base, type: 'fixed', discountPercent };
  }

  // percent
  const pct = Math.min(100, Math.max(0, rule.value));
  const unitPrice = Math.ceil(base * (1 - pct / 100));
  return { unitPrice, originalUnitPrice: base, type: 'percent', discountPercent: pct };
}

/**
 * Loads reseller price overrides visible to the current user (RLS returns global +
 * product-wide rules plus the caller's own reseller-specific rules) and exposes a
 * resolver. `resellerId` defaults to the signed-in user (the reseller themselves).
 */
export function useResellerPricing(resellerId?: string) {
  const { user } = useAuth();
  const effectiveResellerId = resellerId ?? user?.id ?? null;
  const [overrides, setOverrides] = useState<ResellerPriceOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reseller_price_overrides')
      .select('id, reseller_id, service_id, price_type, value');
    setOverrides((data as ResellerPriceOverride[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getPrice = useCallback(
    (service: Pick<DbService, 'id' | 'price'>): ResolvedResellerPrice =>
      computeResellerPrice(service, overrides, effectiveResellerId),
    [overrides, effectiveResellerId],
  );

  return { overrides, getPrice, loading, reload: load };
}
