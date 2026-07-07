import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MapPin, Building2, Navigation, RefreshCw, Loader2, Clock } from 'lucide-react';

/**
 * Admin maintenance card: re-sync the Al-Waseet محافظات/مناطق reference data into our DB via the
 * `sync-alwaseet-locations` edge function (admin-gated). Shows the current counts + last sync time.
 */
const AdminLocationsSync = () => {
  const [cities, setCities] = useState<number | null>(null);
  const [regions, setRegions] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadCounts = useCallback(async () => {
    const [{ count: cityCount }, { count: regionCount }, { data: latest }] = await Promise.all([
      supabase.from('alwaseet_cities' as never).select('*', { count: 'exact', head: true }),
      supabase.from('alwaseet_regions' as never).select('*', { count: 'exact', head: true }),
      supabase.from('alwaseet_cities' as never).select('synced_at').order('synced_at', { ascending: false }).limit(1),
    ]);
    setCities(cityCount ?? 0);
    setRegions(regionCount ?? 0);
    setLastSync((latest as { synced_at?: string }[] | null)?.[0]?.synced_at ?? null);
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-alwaseet-locations');
      // supabase-js collapses non-2xx into a generic error; read the function's own {error} body.
      if (error) {
        let message = error.message || 'فشل المزامنة';
        const ctx = (error as { context?: unknown }).context;
        if (ctx && typeof (ctx as Response).json === 'function') {
          try { const b = await (ctx as Response).json(); if (b?.error) message = b.error; } catch { /* keep */ }
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(`تمت المزامنة: ${data?.cities ?? 0} محافظة، ${Number(data?.regions ?? 0).toLocaleString('en-US')} منطقة`);
      loadCounts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل المزامنة');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            مواقع التوصيل (الوسيط)
          </h3>
          <p className="text-sm text-muted-foreground">المحافظات والمناطق المستخدمة في تسجيل الزبائن وعناوين التوصيل — تُجلب من شركة الوسيط</p>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="rounded-xl gap-1.5 w-full sm:w-auto">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'جاري المزامنة...' : 'تحديث المواقع من الوسيط'}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><Building2 className="w-3.5 h-3.5" />المحافظات</div>
          <p className="text-xl font-bold text-foreground">{cities === null ? '—' : cities.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><Navigation className="w-3.5 h-3.5" />المناطق</div>
          <p className="text-xl font-bold text-foreground">{regions === null ? '—' : regions.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><Clock className="w-3.5 h-3.5" />آخر تحديث</div>
          <p className="text-sm font-medium text-foreground">
            {lastSync ? new Date(lastSync).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }) : 'لم تتم المزامنة بعد'}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-3 mt-3 leading-relaxed">
        💡 شغّل المزامنة فقط عند الحاجة (مثلاً عند إضافة الوسيط مناطق جديدة). تُحدّث القائمة الموجودة وتضيف الجديد دون حذف اختيارات الزبائن الحالية.
      </p>
    </div>
  );
};

export default AdminLocationsSync;
