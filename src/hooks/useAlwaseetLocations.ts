import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Al-Waseet location reference data (synced into public.alwaseet_cities / public.alwaseet_regions
 * by the sync-alwaseet-locations edge function). Drives the cascading محافظة → منطقة selectors.
 * Tables aren't in the generated Supabase types yet → cast `as never` like the other new tables.
 */
export interface AwLocation {
  id: number;
  name: string;
}

/** All محافظات (18 governorates), alphabetical. Loaded once. */
export function useAlwaseetCities() {
  const [cities, setCities] = useState<AwLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('alwaseet_cities' as never)
        .select('id, name')
        .order('name', { ascending: true });
      if (!cancelled) {
        setCities(((data as unknown as AwLocation[]) || []));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { cities, loading };
}

/** مناطق for a given city, loaded on demand (Baghdad has ~750, well under the 2000 cap). */
export function useAlwaseetRegions(cityId: number | null) {
  const [regions, setRegions] = useState<AwLocation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cityId) { setRegions([]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('alwaseet_regions' as never)
        .select('id, name')
        .eq('city_id' as never, cityId as never)
        .order('name', { ascending: true })
        .limit(2000);
      if (!cancelled) {
        setRegions(((data as unknown as AwLocation[]) || []));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cityId]);

  return { regions, loading };
}
