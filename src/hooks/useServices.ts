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
      .order('sort_order', { ascending: true }) as any;
    setServices(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Parent services (no parent_id)
  const parentServices = services.filter(s => !s.parent_id);
  // Get sub-services for a given parent
  const getSubServices = (parentId: string) => services.filter(s => s.parent_id === parentId);

  return { services, parentServices, getSubServices, loading, reload: load };
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
