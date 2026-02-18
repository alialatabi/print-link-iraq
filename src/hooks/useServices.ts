import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DbService {
  id: string;
  label: string;
  icon: string;
  description: string;
  sort_order: number;
}

export interface DbSpecialization {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
}

export function useServices() {
  const [services, setServices] = useState<DbService[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true }) as any;
    setServices(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return { services, loading, reload: load };
}

export function useSpecializations() {
  const [specializations, setSpecializations] = useState<DbSpecialization[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('specializations')
      .select('*')
      .order('sort_order', { ascending: true }) as any;
    setSpecializations(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return { specializations, loading, reload: load };
}

/** Build a label lookup map from services/specializations arrays */
export function buildLabelMap(items: { id: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(items.map(i => [i.id, i.label]));
}
