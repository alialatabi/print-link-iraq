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

// ─────────────────────────────────────────────────────────────────────────────
// Variant-tier reseller pricing (2026-07): a variant tier prices an
// admin-picked, arbitrary quantity as one lump total (see src/types/variants.ts),
// not a rate × qty — so only PERCENT overrides (a pure ratio) map onto it.
// FIXED overrides are expressed as a replacement unit price PER min_quantity
// (the legacy per-service rate model) and have no meaningful equivalent for a
// tier total, so they are IGNORED here; percent overrides still apply.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedTierPrice {
  /** Charged price for this tier after any PERCENT override (post-discount). */
  price: number;
  /** Tier's pre-discount total (`VariantTier.price`), for strikethrough display. */
  originalPrice: number;
  /** Effective discount percent applied (0 when no rule, or when the resolved rule is FIXED). */
  discountPercent: number;
}

/** Resolve the PERCENT-only discount for a (reseller, service) pair; 0 if the winning rule is FIXED or absent. */
function resolveVariantDiscountPercent(
  overrides: ResellerPriceOverride[],
  resellerId: string | null,
  serviceId: string,
): number {
  const rule = resolveOverride(overrides, resellerId, serviceId);
  if (!rule || rule.price_type === 'fixed') return 0;
  return Math.min(100, Math.max(0, rule.value));
}

/**
 * Resolve a variant tier's reseller-charged price. `tierPrice` is the tier's
 * pre-discount total (`VariantTier.price`). The rounding here (`Math.round`)
 * MUST match `discountedTierPrice` (src/components/VariantPicker.tsx) and
 * `buildVariantPricingSnapshot` (src/lib/orderPricing.ts), which apply the
 * identical formula — money parity requires all three to stay in lockstep.
 */
export function resolveTierPrice(
  overrides: ResellerPriceOverride[],
  resellerId: string | null,
  service: Pick<DbService, 'id'>,
  tierPrice: number,
): ResolvedTierPrice {
  const discountPercent = resolveVariantDiscountPercent(overrides, resellerId, service.id);
  const price = discountPercent > 0 ? Math.round(tierPrice * (1 - discountPercent / 100)) : tierPrice;
  return { price, originalPrice: tierPrice, discountPercent };
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

  /** Variant-tier resolver — see `resolveTierPrice` above for the FIXED-rule limitation. */
  const getTierPrice = useCallback(
    (service: Pick<DbService, 'id'>, tierPrice: number): ResolvedTierPrice =>
      resolveTierPrice(overrides, effectiveResellerId, service, tierPrice),
    [overrides, effectiveResellerId],
  );

  /** The percent a variant product's tiers are discounted by, independent of any one tier's price — feeds `<VariantPicker discountPct>` before a tier is even picked. */
  const getVariantDiscountPercent = useCallback(
    (serviceId: string): number => resolveVariantDiscountPercent(overrides, effectiveResellerId, serviceId),
    [overrides, effectiveResellerId],
  );

  return { overrides, getPrice, getTierPrice, getVariantDiscountPercent, loading, reload: load };
}
