import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AiProductType, AiProductRow, AI_PRODUCT_TYPES, dbRowToAiProduct } from '@/lib/aiDesign';

/**
 * Load the admin-managed AI-design product catalog from `ai_products` (active rows, ordered).
 * Falls back to the bundled `AI_PRODUCT_TYPES` defaults if the table is empty or the fetch fails,
 * so the AI Design page always has something to show.
 */
export function useAiProducts() {
  const [products, setProducts] = useState<AiProductType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('ai_products' as never)
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      const rows = (data as AiProductRow[] | null) || [];
      if (error || rows.length === 0) {
        setProducts(AI_PRODUCT_TYPES);
      } else {
        setProducts(rows.map(dbRowToAiProduct));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { products, loading };
}
