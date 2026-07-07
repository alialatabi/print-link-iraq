import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { VariantAttribute } from '@/types/variants';

export interface DbService {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  description: string;
  sort_order: number;
  price: number;
  cost: number;
  parent_id: string | null;
  completion_days: number;
  min_quantity: number;
  cellophane_type: string;
  // Channel flags (AI catalog now lives in services). print_enabled gates the printed-services browse.
  print_enabled?: boolean;
  ai_enabled?: boolean;
  ai_fee?: number;
  // Printed faces per design version: 1 = single file, 2 = front + back (two-face products).
  faces?: number;
  /**
   * Product-wide customer choices (ink color, bag color…) for variant-tier
   * products — see src/types/variants.ts. Null/absent = no attributes.
   */
  variant_attributes?: VariantAttribute[] | null;
  /**
   * Consolidated service id that replaced this old duplicated sub-service at
   * the variant-tier flip. Pickers that list print-disabled services too
   * (upload flow, reseller) must exclude superseded rows.
   */
  superseded_by?: string | null;
}

export interface DbSpecialization {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  sort_order: number;
}

// Catalog reference data changes rarely; cache it for 10 minutes so browsing
// between category/sub-service/template pages no longer refetches on every
// navigation. Consumers that need fresh data after an edit call reload().
const CATALOG_STALE_TIME = 10 * 60_000;

// Module-level stable empty arrays so the returned references don't change
// between renders while data is loading (consumers that memo on them stay stable).
const EMPTY_SERVICES: DbService[] = [];
const EMPTY_SPECIALIZATIONS: DbSpecialization[] = [];

export function useServices() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await supabase
        .from('services')
        .select('*')
        .order('sort_order', { ascending: true });
      return (data as unknown as DbService[]) ?? [];
    },
    staleTime: CATALOG_STALE_TIME,
  });

  const services = data ?? EMPTY_SERVICES;

  // Parent categories shown in the printed-services browse (AI-only categories are hidden).
  const parentServices = useMemo(
    () => services.filter(s => !s.parent_id && s.print_enabled !== false),
    [services],
  );
  // Sub-services under a parent, limited to print-enabled ones (AI-only products are hidden here).
  const getSubServices = useCallback(
    (parentId: string) => services.filter(s => s.parent_id === parentId && s.print_enabled !== false),
    [services],
  );
  const reload = useCallback(async () => { await refetch(); }, [refetch]);

  return { services, parentServices, getSubServices, loading: isLoading, reload };
}

export function useSpecializations() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['specializations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('specializations')
        .select('*')
        .order('sort_order', { ascending: true });
      return (data as unknown as DbSpecialization[]) ?? [];
    },
    staleTime: CATALOG_STALE_TIME,
  });
  const reload = useCallback(async () => { await refetch(); }, [refetch]);

  return { specializations: data ?? EMPTY_SPECIALIZATIONS, loading: isLoading, reload };
}

/** Build a label lookup map from services/specializations arrays */
export function buildLabelMap(items: { id: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(items.map(i => [i.id, i.label]));
}
