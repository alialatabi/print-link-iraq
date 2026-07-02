import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  label: string;
  type: 'service' | 'sub_service' | 'template';
  typeLabel: string;
  link: string;
  icon?: string;
  iconUrl?: string | null;
  parentLabel?: string;
}

interface CachedService {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  parent_id: string | null;
}

interface CachedTemplate {
  id: string;
  name: string;
  service_type: string;
  preview_url: string | null;
}

interface CachedData {
  services: CachedService[];
  templates: CachedTemplate[];
}

// The full services + templates dataset is only needed once the user actually
// intends to search. Cache it for 10 minutes so subsequent searches (and pages)
// reuse it. Keyed globally so every SearchBar instance shares one fetch.
const SEARCH_STALE_TIME = 10 * 60_000;

async function loadSearchDataset(): Promise<CachedData> {
  const [sRes, tRes] = await Promise.all([
    supabase.from('services').select('id, label, icon, icon_url, parent_id').order('sort_order'),
    supabase.from('templates').select('id, name, service_type, preview_url'),
  ]);
  return {
    services: sRes.data ?? [],
    templates: tRes.data ?? [],
  };
}

const normalizeArabic = (text: string) =>
  text
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .trim();

/**
 * Search over services + templates.
 *
 * The dataset is loaded lazily: it only fetches once the user shows search
 * intent — either the SearchBar is focused/open (`active`) or a query has been
 * typed. Previously it downloaded everything on mount of every page because the
 * SearchBar lives in the header. `staleTime` keeps it cached across pages.
 */
export function useSearch(query: string, active = false) {
  const enabled = active || query.trim().length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ['search-dataset'],
    queryFn: loadSearchDataset,
    enabled,
    staleTime: SEARCH_STALE_TIME,
  });

  const results = useMemo<SearchResult[]>(() => {
    if (!data || !query.trim()) return [];
    const q = normalizeArabic(query);

    const matches: SearchResult[] = [];

    // Search parent services
    const parents = data.services.filter(s => !s.parent_id);
    const parentMap = Object.fromEntries(parents.map(p => [p.id, p.label]));

    for (const s of data.services) {
      if (normalizeArabic(s.label).includes(q)) {
        const isParent = !s.parent_id;
        matches.push({
          id: s.id,
          label: s.label,
          type: isParent ? 'service' : 'sub_service',
          typeLabel: isParent ? 'قسم' : 'خدمة',
          link: isParent ? `/sub-services/${s.id}` : `/templates/${s.id}`,
          icon: s.icon,
          iconUrl: s.icon_url,
          parentLabel: !isParent && s.parent_id ? parentMap[s.parent_id] : undefined,
        });
      }
    }

    // Search templates
    for (const t of data.templates) {
      if (normalizeArabic(t.name).includes(q)) {
        const serviceLabel = data.services.find(s => s.id === t.service_type)?.label;
        matches.push({
          id: t.id,
          label: t.name,
          type: 'template',
          typeLabel: 'قالب',
          link: `/template/${t.id}`,
          parentLabel: serviceLabel,
        });
      }
    }

    return matches.slice(0, 12);
  }, [data, query]);

  // Only surface a loading state once we've actually triggered a fetch.
  const loading = enabled && isLoading;

  return { results, loading };
}
