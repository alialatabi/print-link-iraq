import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  id: string;
  label: string;
  type: 'service' | 'sub_service' | 'template' | 'specialization';
  typeLabel: string;
  link: string;
  icon?: string;
  iconUrl?: string | null;
  parentLabel?: string;
}

interface CachedData {
  services: any[];
  templates: any[];
  specializations: any[];
}

let cachedData: CachedData | null = null;

export function useSearch(query: string) {
  const [allData, setAllData] = useState<CachedData | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    if (cachedData) return;
    const load = async () => {
      const [sRes, tRes, spRes] = await Promise.all([
        supabase.from('services').select('id, label, icon, icon_url, parent_id').order('sort_order'),
        supabase.from('templates').select('id, name, service_type, preview_url'),
        supabase.from('specializations').select('id, label, icon, icon_url').order('sort_order'),
      ]);
      const data = {
        services: sRes.data || [],
        templates: tRes.data || [],
        specializations: spRes.data || [],
      };
      cachedData = data;
      setAllData(data);
      setLoading(false);
    };
    load();
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    if (!allData || !query.trim()) return [];
    const q = query.trim().toLowerCase();

    const matches: SearchResult[] = [];

    // Search parent services
    const parents = allData.services.filter(s => !s.parent_id);
    const parentMap = Object.fromEntries(parents.map(p => [p.id, p.label]));

    for (const s of allData.services) {
      if (s.label.toLowerCase().includes(q)) {
        const isParent = !s.parent_id;
        matches.push({
          id: s.id,
          label: s.label,
          type: isParent ? 'service' : 'sub_service',
          typeLabel: isParent ? 'قسم' : 'خدمة',
          link: isParent ? `/sub-services/${s.id}` : `/templates/${s.id}`,
          icon: s.icon,
          iconUrl: s.icon_url,
          parentLabel: !isParent ? parentMap[s.parent_id] : undefined,
        });
      }
    }

    // Search templates
    for (const t of allData.templates) {
      if (t.name.toLowerCase().includes(q)) {
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

    // Search specializations
    for (const sp of allData.specializations) {
      if (sp.label.toLowerCase().includes(q)) {
        matches.push({
          id: sp.id,
          label: sp.label,
          type: 'specialization',
          typeLabel: 'تخصص',
          link: `/specializations/${sp.id}`,
          icon: sp.icon,
          iconUrl: sp.icon_url,
        });
      }
    }

    return matches.slice(0, 12);
  }, [allData, query]);

  return { results, loading };
}
