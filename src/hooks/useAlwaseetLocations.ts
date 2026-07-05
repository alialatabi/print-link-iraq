import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeLocations } from '@/lib/locationName';

/**
 * Al-Waseet location reference data (synced into public.alwaseet_cities / public.alwaseet_regions
 * by the sync-alwaseet-locations edge function). Drives the cascading محافظة → منطقة selectors.
 * Tables aren't in the generated Supabase types yet → cast `as never` like the other new tables.
 */
export interface AwLocation {
  id: number;
  name: string;
}

// Governorate/region lists are static reference data — cache for an hour so the
// cascading selects never refetch mid-session.
const LOCATIONS_STALE_TIME = 60 * 60_000;

const EMPTY_LOCATIONS: AwLocation[] = [];

/** All محافظات (18 governorates), alphabetical. Loaded once. */
export function useAlwaseetCities() {
  const { data, isLoading } = useQuery({
    queryKey: ['alwaseet-cities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('alwaseet_cities' as never)
        .select('id, name')
        .order('name', { ascending: true });
      // Display-level cleanup only — the DB rows (and the ids we save) stay untouched.
      return sanitizeLocations((data as unknown as AwLocation[]) ?? []);
    },
    staleTime: LOCATIONS_STALE_TIME,
  });

  return { cities: data ?? EMPTY_LOCATIONS, loading: isLoading };
}

/** مناطق for a given city, loaded on demand (Baghdad has ~750, well under the 2000 cap). */
export function useAlwaseetRegions(cityId: number | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['alwaseet-regions', cityId],
    queryFn: async () => {
      const { data } = await supabase
        .from('alwaseet_regions' as never)
        .select('id, name')
        .eq('city_id' as never, cityId as never)
        .order('name', { ascending: true })
        .limit(2000);
      // The synced catalog has junk rows (digits-only, stray Latin, leading "_") —
      // hide/clean them for display without mutating the DB.
      return sanitizeLocations((data as unknown as AwLocation[]) ?? []);
    },
    enabled: !!cityId,
    staleTime: LOCATIONS_STALE_TIME,
  });

  // isLoading is false while the query is disabled (no city picked), matching the
  // previous hook which only flipped loading true once a city was selected.
  return { regions: data ?? EMPTY_LOCATIONS, loading: isLoading };
}
