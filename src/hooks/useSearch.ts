import { useState, useEffect, useMemo } from 'react';
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

let cachedData: CachedData | null = null;

export function useSearch(query: string) {
  const [allData, setAllData] = useState<CachedData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    if (cachedData) return;
    const load = async () => {
      const [sRes, tRes] = await Promise.all([
        supabase.from('services').select('id, label, icon, icon_url, parent_id').order('sort_order'),
        supabase.from('templates').select('id, name, service_type, preview_url'),
      ]);
      const data = {
        services: sRes.data || [],
        templates: tRes.data || [],
      };
      cachedData = data;
      setAllData(data);
      setLoading(false);
    };
    load();
  }, []);

  const normalizeArabic = (text: string) =>
    text
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .toLowerCase()
      .trim();

  const results = useMemo<SearchResult[]>(() => {
    if (!allData || !query.trim()) return [];
    const q = normalizeArabic(query);

    const matches: SearchResult[] = [];

    // Search parent services
    const parents = allData.services.filter(s => !s.parent_id);
    const parentMap = Object.fromEntries(parents.map(p => [p.id, p.label]));

    for (const s of allData.services) {
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
    for (const t of allData.templates) {
      if (normalizeArabic(t.name).includes(q)) {
        const serviceLabel = allData.services.find(s => s.id === t.service_type)?.label;
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
  }, [allData, query]);

  return { results, loading };
}
