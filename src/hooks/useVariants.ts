import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ServiceVariant } from '@/types/variants';

// Same catalog cache window as useServices — variants change as rarely as services.
const CATALOG_STALE_TIME = 10 * 60_000;

const EMPTY_VARIANTS: ServiceVariant[] = [];

/**
 * Load the whole `service_variants` table once (small: a few dozen rows) and
 * expose a per-service accessor. Inactive variants are kept in `variants`
 * (admin screens need them) — `getVariants` returns only active ones, sorted,
 * which is what customer flows want.
 *
 * `as never` casts: the generated Supabase types don't know the table yet
 * (same pattern as the AI catalog columns in useAiProducts).
 */
export function useServiceVariants() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['service_variants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('service_variants' as never)
        .select('*')
        .order('sort_order', { ascending: true });
      return ((data as unknown as ServiceVariant[]) ?? []);
    },
    staleTime: CATALOG_STALE_TIME,
  });

  const variants = data ?? EMPTY_VARIANTS;

  const getVariants = useCallback(
    (serviceId: string) => variants.filter(v => v.service_id === serviceId && v.active),
    [variants],
  );

  const reload = useCallback(async () => { await refetch(); }, [refetch]);

  return { variants, getVariants, loading: isLoading, reload };
}
