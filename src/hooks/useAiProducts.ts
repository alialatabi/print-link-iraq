import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AiProductType, AiServiceRow, AI_PRODUCT_TYPES, dbServiceToAiProduct } from '@/lib/aiDesign';

/**
 * Load the AI-design product catalog from the unified `services` table — every sub-service
 * flagged `ai_enabled` is an AI-designable product, carrying its own `ai_*` config. Ordered by
 * `sort_order` (the same order the admin drags in the Services tab). Falls back to the bundled
 * `AI_PRODUCT_TYPES` defaults if nothing is AI-enabled or the fetch fails, so the AI Design page
 * always has something to show.
 */
export function useAiProducts() {
  const [products, setProducts] = useState<AiProductType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // `as never` keeps this untyped: the generated Supabase types don't yet include the ai_* columns.
      const { data, error } = await supabase
        .from('services' as never)
        .select('id,label,sort_order,ai_enabled,ai_fee,ai_canvas,ai_size_label,ai_option_label,ai_options,ai_custom_size,ai_directives')
        .eq('ai_enabled' as never, true as never)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      const rows = (data as AiServiceRow[] | null) || [];
      if (error || rows.length === 0) {
        setProducts(AI_PRODUCT_TYPES);
      } else {
        setProducts(rows.map(dbServiceToAiProduct));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { products, loading };
}
