import { useState, useEffect, useCallback, useMemo } from 'react';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Sparkles, Search, RefreshCw, Image as ImageIcon, User, Calendar,
  ShoppingBag, Download, ImageOff, Wand2, Maximize2, Trash2, CheckSquare, X, Loader2,
} from 'lucide-react';
import { AI_PRODUCT_TYPES } from '@/lib/aiDesign';
import { useAiProducts } from '@/hooks/useAiProducts';

/** One generated AI design row (public.ai_generations) joined with its customer profile. */
interface AiDesignRow {
  id: string;
  user_id: string;
  brief: string | null;
  product_type: string | null;
  size: string | null;
  rewritten_prompt: string | null;
  image_url: string | null;
  order_item_id: string | null;
  cost_iqd: number | null;
  created_at: string;
  display_name: string | null;
  phone: string | null;
}

// Date presets → days back, or null for all-time (mirrors AdminAiUsage for consistency).
const PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'الكل', days: null },
  { id: 'today', label: 'اليوم', days: 0 },
  { id: '7', label: '7 أيام', days: 7 },
  { id: '30', label: '30 يوم', days: 30 },
];
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const iqd = (n: number) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} د.ع`;

// Extract the storage object path from a public order-attachments URL so the file can be removed.
// e.g. https://…/object/public/order-attachments/ai-generations/<uid>/<id>.png → ai-generations/<uid>/<id>.png
const BUCKET = 'order-attachments';
const pathFromPublicUrl = (url: string): string | null => {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
};

// Force a download via a transient anchor; order-attachments URLs honour ?download=.
const triggerDownload = (url: string, filename: string) => {
  const sep = url.includes('?') ? '&' : '?';
  const a = document.createElement('a');
  a.href = `${url}${sep}download=${encodeURIComponent(filename)}`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const AdminAiDesigns = () => {
  const [rows, setRows] = useState<AiDesignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [orderedFilter, setOrderedFilter] = useState('all'); // all | ordered | not
  const [sortBy, setSortBy] = useState('newest');
  const [preset, setPreset] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Lightbox
  const [lightbox, setLightbox] = useState<AiDesignRow | null>(null);

  // Multi-select + bulk delete
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => setSelected(new Set());

  // Live AI catalog labels (services) merged with the bundled defaults so every product_type id
  // resolves to a readable Arabic label, even legacy ones.
  const { products } = useAiProducts();
  const labelOf = useCallback((id: string | null): string => {
    if (!id) return 'غير محدد';
    const live = products.find(p => p.id === id);
    if (live) return live.label;
    const fallback = AI_PRODUCT_TYPES.find(p => p.id === id);
    return fallback?.label || id;
  }, [products]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // RLS: admins read every row via the existing "Users read own ai generations" policy.
    // Untyped table (not in generated types) — cast like the rest of the AI/vault code.
    const { data, error: genErr } = await supabase
      .from('ai_generations' as never)
      .select('id, user_id, brief, product_type, size, rewritten_prompt, image_url, order_item_id, cost_iqd, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (genErr) {
      setError('تعذّر تحميل التصاميم');
      setRows([]);
      setLoading(false);
      return;
    }

    const gens = (data as unknown as Omit<AiDesignRow, 'display_name' | 'phone'>[]) || [];
    // Enrich with customer profiles (fetched separately, mirroring AdminPanel.loadOrders).
    const userIds = [...new Set(gens.map(g => g.user_id))];
    const profileMap = new Map<string, { display_name: string | null; phone: string | null }>();
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, phone')
        .in('user_id', userIds);
      (profiles || []).forEach(p => profileMap.set(p.user_id, { display_name: p.display_name, phone: p.phone }));
    }

    setRows(gens.map(g => ({
      ...g,
      cost_iqd: Number(g.cost_iqd || 0),
      display_name: profileMap.get(g.user_id)?.display_name ?? null,
      phone: profileMap.get(g.user_id)?.phone ?? null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find(x => x.id === id);
    if (!p || p.days === null) { setFrom(''); setTo(''); return; }
    const now = new Date();
    setFrom(ymd(new Date(now.getTime() - p.days * 86_400_000)));
    setTo(ymd(now));
  };
  const onDateInput = (which: 'from' | 'to', value: string) => {
    setPreset('');
    if (which === 'from') setFrom(value); else setTo(value);
  };

  // The distinct product types present in the data — populates the filter dropdown.
  const productTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.product_type) set.add(r.product_type); });
    return [...set].sort((a, b) => labelOf(a).localeCompare(labelOf(b), 'ar'));
  }, [rows, labelOf]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T00:00:00`).getTime() + 86_400_000 : null; // inclusive end
    let list = rows.filter(r => {
      if (productFilter !== 'all' && r.product_type !== productFilter) return false;
      if (orderedFilter === 'ordered' && !r.order_item_id) return false;
      if (orderedFilter === 'not' && r.order_item_id) return false;
      const ts = new Date(r.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts >= toTs) return false;
      if (q) {
        const hay = `${r.display_name || ''} ${r.phone || ''} ${r.brief || ''} ${r.rewritten_prompt || ''} ${labelOf(r.product_type)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortBy === 'oldest' ? da - db : db - da;
    });
    return list;
  }, [rows, search, productFilter, orderedFilter, from, to, sortBy, labelOf]);

  const stats = useMemo(() => ({
    total: rows.length,
    withImage: rows.filter(r => r.image_url).length,
    ordered: rows.filter(r => r.order_item_id).length,
    customers: new Set(rows.map(r => r.user_id)).size,
  }), [rows]);

  const custName = (r: AiDesignRow) => {
    const name = r.display_name || '';
    if (!name || name === r.phone || /^[?\s]+$/.test(name)) return 'زبون';
    return name;
  };

  // Select-all operates on the currently FILTERED rows (what the admin sees).
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const toggleSelectAll = () => setSelected(prev => {
    const next = new Set(prev);
    if (filtered.every(r => next.has(r.id))) filtered.forEach(r => next.delete(r.id));
    else filtered.forEach(r => next.add(r.id));
    return next;
  });

  const handleDeleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setDeleting(true);
    try {
      // Remove the stored images first (best-effort — never blocks the row delete).
      const paths = rows
        .filter(r => selected.has(r.id) && r.image_url)
        .map(r => pathFromPublicUrl(r.image_url!))
        .filter((p): p is string => !!p);
      if (paths.length) {
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
        if (rmErr) console.error('storage remove failed:', rmErr.message);
      }
      // Delete the rows (RLS: admins only, via the "Admins delete ai generations" policy).
      const { error } = await supabase.from('ai_generations' as never).delete().in('id', ids as never);
      if (error) throw error;
      toast.success(`تم حذف ${ids.length} تصميم`);
      clearSelection();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الحذف');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            تصاميم الذكاء الاصطناعي
          </h3>
          <p className="text-sm text-muted-foreground">كل التصاميم التي أنشأها الزبائن بالذكاء الاصطناعي — مع نوع المطبوعة والبحث والفلترة</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="rounded-xl">
          <RefreshCw className="w-4 h-4 ml-1" />
          تحديث
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><ImageIcon className="w-3.5 h-3.5" />إجمالي التصاميم</div>
          <p className="text-xl font-bold text-foreground">{stats.total.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><ShoppingBag className="w-3.5 h-3.5" />تم طلبها</div>
          <p className="text-xl font-bold text-success">{stats.ordered.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><User className="w-3.5 h-3.5" />زبائن</div>
          <p className="text-xl font-bold text-foreground">{stats.customers.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><ImageIcon className="w-3.5 h-3.5" />بصورة محفوظة</div>
          <p className="text-xl font-bold text-foreground">{stats.withImage.toLocaleString('en-US')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالزبون أو الوصف..."
              className="pr-9 rounded-lg"
              dir="rtl"
            />
          </div>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="rounded-lg"><SelectValue placeholder="نوع المطبوعة" /></SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">جميع الأنواع</SelectItem>
              {productTypes.map(pt => (
                <SelectItem key={pt} value={pt}>
                  {labelOf(pt)} ({rows.filter(r => r.product_type === pt).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={orderedFilter} onValueChange={setOrderedFilter}>
            <SelectTrigger className="rounded-lg"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">الكل (مطلوبة وغير مطلوبة)</SelectItem>
              <SelectItem value="ordered">تم طلبها فقط</SelectItem>
              <SelectItem value="not">لم تُطلب</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="rounded-lg"><SelectValue placeholder="الترتيب" /></SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="newest">الأحدث أولاً</SelectItem>
              <SelectItem value="oldest">الأقدم أولاً</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${preset === p.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:border-primary/40'}`}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-2 mr-auto">
            <label className="text-xs text-muted-foreground">من</label>
            <Input type="date" value={from} onChange={e => onDateInput('from', e.target.value)} className="h-8 w-auto rounded-lg text-xs" dir="ltr" />
            <label className="text-xs text-muted-foreground">إلى</label>
            <Input type="date" value={to} onChange={e => onDateInput('to', e.target.value)} className="h-8 w-auto rounded-lg text-xs" dir="ltr" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
            عرض <span className="font-bold text-foreground">{filtered.length}</span> من {rows.length} تصميم
          </span>
          {filtered.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {allFilteredSelected ? 'إلغاء تحديد الكل' : `تحديد الكل (${filtered.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar — appears when ≥1 design is selected */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-2 z-20 flex items-center justify-between gap-3 flex-wrap bg-primary/10 border border-primary/30 rounded-xl px-4 py-2.5 backdrop-blur"
        >
          <span className="text-sm font-bold text-primary flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            {selected.size.toLocaleString('en-US')} تصميم محدد
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-xs gap-1">
              <X className="w-3.5 h-3.5" />
              إلغاء التحديد
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-8 text-xs gap-1.5" disabled={deleting}>
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  حذف المحدد ({selected.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-destructive" />
                    حذف التصاميم المحددة
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    هل أنت متأكد من حذف <strong>{selected.size}</strong> تصميم؟ سيتم حذف سجل التصميم وصورته نهائياً ولا يمكن التراجع.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel>تراجع</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteSelected}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    نعم، حذف نهائي
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>
      )}

      {/* Gallery */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">جاري التحميل...</div>
      ) : error ? (
        <div className="py-12 text-center text-destructive text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{rows.length === 0 ? 'لا توجد تصاميم بعد' : 'لا نتائج مطابقة'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((r, i) => {
            const isSelected = selected.has(r.id);
            return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.015, 0.3) }}
              className={`relative bg-card rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col ${isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border'}`}
            >
              {/* Selection checkbox (layered above the image; toggles, doesn't open the lightbox) */}
              <div className="absolute top-2 left-2 z-10">
                <span className={`flex items-center justify-center w-6 h-6 rounded-md border shadow-sm transition-colors ${isSelected ? 'bg-primary border-primary' : 'bg-background/85 border-border hover:border-primary/50'}`}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(r.id)}
                    className="border-0 data-[state=checked]:bg-transparent data-[state=checked]:text-primary-foreground"
                    aria-label="تحديد التصميم"
                  />
                </span>
              </div>

              {/* Image — object-contain so the FULL print design is visible (portrait cards,
                  landscape banners, etc.) instead of being cropped to the square. */}
              <button
                onClick={() => r.image_url && setLightbox(r)}
                disabled={!r.image_url}
                className="relative aspect-square bg-gradient-to-br from-muted/50 to-muted/20 overflow-hidden group disabled:cursor-default flex items-center justify-center p-2"
              >
                {r.image_url ? (
                  <>
                    <img
                      src={r.image_url}
                      alt={r.brief || labelOf(r.product_type)}
                      loading="lazy"
                      className="max-w-full max-h-full object-contain rounded-md shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    <span className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-background/90 text-foreground text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1 shadow">
                        <Maximize2 className="w-3 h-3" /> عرض
                      </span>
                    </span>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground/50">
                    <ImageOff className="w-8 h-8" />
                    <span className="text-[10px]">لم تُحفظ الصورة</span>
                  </div>
                )}
                {r.order_item_id && (
                  <span className="absolute top-2 right-2 bg-success text-success-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <ShoppingBag className="w-2.5 h-2.5" /> مطلوب
                  </span>
                )}
              </button>

              {/* Meta */}
              <div className="p-3 space-y-1.5 flex-1 flex flex-col">
                <Badge variant="secondary" className="text-[10px] w-fit bg-primary/10 text-primary border-primary/20">
                  {labelOf(r.product_type)}
                </Badge>
                {r.brief && <p className="text-xs text-foreground/80 line-clamp-2 leading-snug">{r.brief}</p>}
                <div className="mt-auto pt-1.5 space-y-0.5">
                  <p className="text-[11px] text-foreground font-medium flex items-center gap-1 truncate">
                    <User className="w-3 h-3 shrink-0 text-muted-foreground" />
                    {custName(r)}
                  </p>
                  {r.phone && <p className="text-[10px] text-muted-foreground truncate" dir="ltr">{r.phone}</p>}
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(r.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {r.image_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] gap-1 rounded-lg mt-1"
                    onClick={() => triggerDownload(r.image_url!, `ai-${labelOf(r.product_type)}-${r.id.slice(0, 8)}.png`)}
                  >
                    <Download className="w-3 h-3" />
                    تحميل
                  </Button>
                )}
              </div>
            </motion.div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden" dir="rtl">
          <DialogTitle className="sr-only">تفاصيل التصميم</DialogTitle>
          {lightbox && (
            <div className="grid md:grid-cols-[1.4fr_1fr]">
              <div className="bg-muted/30 flex items-center justify-center p-2 max-h-[80vh]">
                {lightbox.image_url && (
                  <img src={lightbox.image_url} alt={lightbox.brief || ''} className="max-w-full max-h-[78vh] object-contain rounded-lg" />
                )}
              </div>
              <div className="p-5 space-y-3 overflow-y-auto max-h-[80vh]">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {labelOf(lightbox.product_type)}
                </Badge>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-0.5"><User className="w-3.5 h-3.5" />الزبون</p>
                  <p className="text-sm font-bold text-foreground">{custName(lightbox)}</p>
                  {lightbox.phone && <p className="text-xs text-muted-foreground" dir="ltr">{lightbox.phone}</p>}
                </div>
                {lightbox.brief && (
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-0.5"><Wand2 className="w-3.5 h-3.5" />الوصف</p>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{lightbox.brief}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1.5 mb-0.5"><Calendar className="w-3.5 h-3.5" />التاريخ</p>
                    <p className="text-foreground">{new Date(lightbox.created_at).toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  {lightbox.size && (
                    <div>
                      <p className="text-muted-foreground mb-0.5">القياس</p>
                      <p className="text-foreground" dir="ltr">{lightbox.size}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground mb-0.5">الحالة</p>
                    <p className={lightbox.order_item_id ? 'text-success font-medium' : 'text-foreground'}>
                      {lightbox.order_item_id ? 'تم طلبها' : 'لم تُطلب'}
                    </p>
                  </div>
                </div>
                {lightbox.image_url && (
                  <Button
                    className="w-full rounded-xl gap-1.5"
                    onClick={() => triggerDownload(lightbox.image_url!, `ai-${labelOf(lightbox.product_type)}-${lightbox.id.slice(0, 8)}.png`)}
                  >
                    <Download className="w-4 h-4" />
                    تحميل التصميم
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAiDesigns;
