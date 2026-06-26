import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
}

export interface DbSpecialization {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  sort_order: number;
}

export function useServices() {
  const [services, setServices] = useState<DbService[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true });
    setServices((data as unknown as DbService[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Parent categories shown in the printed-services browse (AI-only categories are hidden).
  const parentServices = services.filter(s => !s.parent_id && s.print_enabled !== false);
  // Sub-services under a parent, limited to print-enabled ones (AI-only products are hidden here).
  const getSubServices = (parentId: string) => services.filter(s => s.parent_id === parentId && s.print_enabled !== false);

  return { services, parentServices, getSubServices, loading, reload: load };
}

export function useSpecializations() {
  const [specializations, setSpecializations] = useState<DbSpecialization[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('specializations')
      .select('*')
      .order('sort_order', { ascending: true });
    setSpecializations((data as unknown as DbSpecialization[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return { specializations, loading, reload: load };
}

/** Build a label lookup map from services/specializations arrays */
export function buildLabelMap(items: { id: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(items.map(i => [i.id, i.label]));
}
