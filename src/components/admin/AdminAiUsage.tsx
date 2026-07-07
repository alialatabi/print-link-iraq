import { useState, useEffect, useCallback, useMemo } from 'react';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Search, ChevronDown, ChevronUp, User, Image, Coins, Wallet, TrendingUp, RefreshCw } from 'lucide-react';
import { AI_PRODUCT_TYPES } from '@/lib/aiDesign';

interface AiUsageProduct {
  product_type: string;
  label: string;
  generations: number;
  cost_usd: number;
  cost_iqd: number;
  ordered: number;
  spent: number;
}

interface AiUsageRow {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  total_generations: number;
  ordered_items: number;
  total_spent: number;
  total_cost_usd: number;
  total_cost_iqd: number;
  last_used: string | null;
  products: AiUsageProduct[];
}

// Nicer labels for legacy hardcoded product ids that aren't in the admin catalog and were
// never ordered (so the RPC could only fall back to the raw id).
const LEGACY_LABELS: Record<string, string> = Object.fromEntries(
  AI_PRODUCT_TYPES.map((p) => [p.id, p.label]),
);
const productLabel = (p: AiUsageProduct) =>
  p.label && p.label !== p.product_type ? p.label : (LEGACY_LABELS[p.product_type] || p.label || p.product_type);

const iqd = (n: number) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} د.ع`;
const usd = (n: number) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
const num = (n: number) => Number(n || 0).toLocaleString('en-US');

// Date presets → number of days back, or null for all-time.
const PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: 'all', label: 'الكل', days: null },
  { id: 'today', label: 'اليوم', days: 0 },
  { id: '7', label: '7 أيام', days: 7 },
  { id: '30', label: '30 يوم', days: 30 },
];
const ymd = (d: Date) => d.toISOString().slice(0, 10);

const AdminAiUsage = () => {
  const [rows, setRows] = useState<AiUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError(null);
    // [p_from, p_to): convert local dates to ISO; p_to is exclusive, so push the end out by a day
    // to make the chosen end date inclusive.
    const p_from = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : null;
    const p_to = toDate ? new Date(new Date(`${toDate}T00:00:00`).getTime() + 86_400_000).toISOString() : null;
    // Untyped RPC (added after types were generated) — cast the name + args.
    const { data, error } = await supabase.rpc('ai_usage_by_customer' as never, { p_from, p_to } as never);
    if (error) {
      setError('تعذّر تحميل بيانات الاستخدام');
      setRows([]);
    } else {
      setRows(((data as AiUsageRow[]) || []).map((r) => ({
        ...r,
        total_generations: Number(r.total_generations || 0),
        ordered_items: Number(r.ordered_items || 0),
        total_spent: Number(r.total_spent || 0),
        total_cost_usd: Number(r.total_cost_usd || 0),
        total_cost_iqd: Number(r.total_cost_iqd || 0),
        products: (r.products || []).map((p) => ({
          ...p,
          generations: Number(p.generations || 0),
          cost_usd: Number(p.cost_usd || 0),
          cost_iqd: Number(p.cost_iqd || 0),
          ordered: Number(p.ordered || 0),
          spent: Number(p.spent || 0),
        })),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(from, to); }, [load, from, to]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p || p.days === null) { setFrom(''); setTo(''); return; }
    const now = new Date();
    const start = new Date(now.getTime() - p.days * 86_400_000);
    setFrom(ymd(start));
    setTo(ymd(now));
  };

  const onDateInput = (which: 'from' | 'to', value: string) => {
    setPreset('');
    if (which === 'from') setFrom(value); else setTo(value);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.display_name || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q));
  }, [rows, search]);

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.total_spent, 0);
    const costIqd = rows.reduce((s, r) => s + r.total_cost_iqd, 0);
    return {
      customers: rows.length,
      generations: rows.reduce((s, r) => s + r.total_generations, 0),
      revenue,
      costIqd,
      costUsd: rows.reduce((s, r) => s + r.total_cost_usd, 0),
      profit: revenue - costIqd,
    };
  }, [rows]);

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            استخدام الذكاء الاصطناعي لكل زبون
          </h3>
          <p className="text-sm text-muted-foreground">كم استخدم كل زبون ميزة التصميم، ما المنتجات التي صمّمها، التكلفة الفعلية على المنصّة، وكم أنفق</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(from, to)} className="rounded-xl">
          <RefreshCw className="w-4 h-4 ml-1" />
          تحديث
        </Button>
      </div>

      {/* Date range filter */}
      <div className="bg-card rounded-xl border border-border p-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${preset === p.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:border-primary/40'}`}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:mr-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">من</label>
              <Input type="date" value={from} onChange={(e) => onDateInput('from', e.target.value)} className="h-8 w-auto rounded-lg text-xs" dir="ltr" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">إلى</label>
              <Input type="date" value={to} onChange={(e) => onDateInput('to', e.target.value)} className="h-8 w-auto rounded-lg text-xs" dir="ltr" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary tiles (reflect the selected date range) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div className="bg-card rounded-xl border border-border p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><User className="w-3.5 h-3.5 shrink-0" /><span className="truncate">زبائن</span></div>
          <p className="text-xl font-bold text-foreground truncate">{num(totals.customers)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><Image className="w-3.5 h-3.5 shrink-0" /><span className="truncate">تصاميم مولّدة</span></div>
          <p className="text-xl font-bold text-foreground truncate">{num(totals.generations)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><Coins className="w-3.5 h-3.5 shrink-0" /><span className="truncate">الإيراد (رسوم)</span></div>
          <p className="text-xl font-bold text-primary truncate">{iqd(totals.revenue)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><Wallet className="w-3.5 h-3.5 shrink-0" /><span className="truncate">التكلفة الفعلية</span></div>
          <p className="text-xl font-bold text-amber-600 truncate">{iqd(totals.costIqd)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate" dir="ltr">{usd(totals.costUsd)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 min-w-0">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1"><TrendingUp className="w-3.5 h-3.5 shrink-0" /><span className="truncate">الربح</span></div>
          <p className={`text-xl font-bold truncate ${totals.profit >= 0 ? 'text-success' : 'text-destructive'}`}>{iqd(totals.profit)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم الزبون أو رقم الهاتف..."
          className="rounded-xl pr-9"
          dir="rtl"
        />
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>
      ) : error ? (
        <div className="text-center py-12 text-destructive text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{rows.length === 0 ? 'لا يوجد استخدام للذكاء الاصطناعي في هذه الفترة' : 'لا نتائج مطابقة'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, i) => {
            const isOpen = expanded === r.user_id;
            const profit = r.total_spent - r.total_cost_iqd;
            return (
              <motion.div
                key={r.user_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : r.user_id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-right gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-foreground text-sm truncate">{r.display_name || 'زبون'}</h4>
                    <p className="text-xs text-muted-foreground" dir="ltr">{r.phone || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Image className="w-3 h-3" />{num(r.total_generations)}
                    </span>
                    <span className="hidden sm:inline text-[11px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full" title="التكلفة الفعلية">{iqd(r.total_cost_iqd)}</span>
                    <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full" title="رسوم الذكاء الاصطناعي">{iqd(r.total_spent)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-border p-4">
                    <div className="flex items-center justify-between mb-3 text-xs flex-wrap gap-2">
                      <span className="text-muted-foreground">المنتجات التي صمّمها ({r.products.length})</span>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-muted-foreground" dir="ltr" title="التكلفة الفعلية بالدولار">التكلفة: {usd(r.total_cost_usd)}</span>
                        <span className={profit >= 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>الربح: {iqd(profit)}</span>
                        {r.last_used && <span className="text-muted-foreground">آخر استخدام: {new Date(r.last_used).toLocaleDateString('ar')}</span>}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground text-xs border-b border-border/60">
                            <th className="text-right font-medium py-2">المنتج</th>
                            <th className="text-center font-medium py-2">مولّدة</th>
                            <th className="text-center font-medium py-2">التكلفة</th>
                            <th className="text-center font-medium py-2">مطلوبة</th>
                            <th className="text-left font-medium py-2">الرسوم</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.products.map((p) => (
                            <tr key={p.product_type} className="border-b border-border/40 last:border-0">
                              <td className="text-right py-2 text-foreground">{productLabel(p)}</td>
                              <td className="text-center py-2 text-foreground">{num(p.generations)}</td>
                              <td className="text-center py-2 text-amber-600" title={usd(p.cost_usd)}>{iqd(p.cost_iqd)}</td>
                              <td className="text-center py-2 text-muted-foreground">{num(p.ordered)}</td>
                              <td className="text-left py-2 font-medium text-foreground">{iqd(p.spent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAiUsage;
