import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Store, Plus, Phone, MapPin, ChevronDown, ChevronUp, Loader2, Percent, Trash2 } from 'lucide-react';
import { useServices, type DbService } from '@/hooks/useServices';
import {
  type ResellerPriceOverride, computeResellerPrice,
} from '@/hooks/useResellerPricing';

interface ResellerRow {
  user_id: string;
  shop_name: string;
  shop_phone: string;
  shop_address: string;
  login_phone: string | null;
}

const formatIQD = (n: number) => `${Math.round(n || 0).toLocaleString('en-US')} د.ع`;

/** Find the override row that exactly matches a (reseller, service) scope. */
function findExact(
  overrides: ResellerPriceOverride[],
  resellerId: string | null,
  serviceId: string | null,
): ResellerPriceOverride | null {
  return overrides.find(o =>
    (o.reseller_id ?? null) === resellerId && (o.service_id ?? null) === serviceId,
  ) || null;
}

const AdminResellers = () => {
  const { services } = useServices();
  const products = services.filter(s => s.price > 0);

  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [overrides, setOverrides] = useState<ResellerPriceOverride[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ shop_name: '', phone: '', password: '', shop_phone: '', shop_address: '' });
  const [creating, setCreating] = useState(false);

  // Expanded pricing panels
  const [expanded, setExpanded] = useState<string | null>(null); // reseller user_id or 'global'
  const [globalDefault, setGlobalDefault] = useState<number>(20);

  const loadOverrides = useCallback(async () => {
    const { data } = await supabase
      .from('reseller_price_overrides')
      .select('id, reseller_id, service_id, price_type, value');
    const list = (data as ResellerPriceOverride[]) || [];
    setOverrides(list);
    const def = list.find(o => !o.reseller_id && !o.service_id);
    if (def) setGlobalDefault(def.value);
  }, []);

  const loadResellers = useCallback(async () => {
    const { data: rows } = await supabase
      .from('resellers')
      .select('user_id, shop_name, shop_phone, shop_address')
      .order('created_at', { ascending: false });
    const list = (rows || []) as Omit<ResellerRow, 'login_phone'>[];
    if (list.length === 0) { setResellers([]); return; }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, phone')
      .in('user_id', list.map(r => r.user_id));
    const phoneMap = new Map((profiles || []).map(p => [p.user_id, p.phone]));
    setResellers(list.map(r => ({ ...r, login_phone: phoneMap.get(r.user_id) || null })));
  }, []);

  useEffect(() => {
    Promise.all([loadResellers(), loadOverrides()]).then(() => setLoading(false));
  }, [loadResellers, loadOverrides]);

  const handleCreate = async () => {
    if (!form.shop_name.trim()) { toast.error('اسم المطبعة مطلوب'); return; }
    if (!form.phone.trim()) { toast.error('رقم الهاتف مطلوب'); return; }
    if (!form.password || form.password.length < 6) { toast.error('كلمة المرور 6 أحرف على الأقل'); return; }
    if (!form.shop_phone.trim()) { toast.error('رقم المطبعة مطلوب'); return; }
    if (!form.shop_address.trim()) { toast.error('عنوان المطبعة مطلوب'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-reseller', {
        body: {
          phone: form.phone.trim(),
          password: form.password,
          shop_name: form.shop_name.trim(),
          shop_phone: form.shop_phone.trim(),
          shop_address: form.shop_address.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.is_new ? 'تم إنشاء حساب المطبعة' : 'تم تحديث حساب المطبعة');
      setDialogOpen(false);
      setForm({ shop_name: '', phone: '', password: '', shop_phone: '', shop_address: '' });
      loadResellers();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'فشل إنشاء حساب المطبعة');
    } finally {
      setCreating(false);
    }
  };

  const saveOverride = async (
    resellerId: string | null, serviceId: string | null,
    price_type: 'percent' | 'fixed', value: number,
  ) => {
    const existing = findExact(overrides, resellerId, serviceId);
    if (existing) {
      const { error } = await supabase
        .from('reseller_price_overrides')
        .update({ price_type, value })
        .eq('id', existing.id);
      if (error) { toast.error('فشل حفظ السعر'); return; }
    } else {
      const { error } = await supabase
        .from('reseller_price_overrides')
        .insert({ reseller_id: resellerId, service_id: serviceId, price_type, value });
      if (error) { toast.error('فشل حفظ السعر'); return; }
    }
    toast.success('تم حفظ السعر');
    loadOverrides();
  };

  const clearOverride = async (resellerId: string | null, serviceId: string | null) => {
    const existing = findExact(overrides, resellerId, serviceId);
    if (!existing) return;
    const { error } = await supabase.from('reseller_price_overrides').delete().eq('id', existing.id);
    if (error) { toast.error('فشل المسح'); return; }
    toast.success('تم الرجوع للافتراضي');
    loadOverrides();
  };

  const saveGlobalDefault = async () => {
    await saveOverride(null, null, 'percent', Math.min(100, Math.max(0, globalDefault)));
  };

  if (loading) return <div className="py-16 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            المطابع والمكاتب
          </h3>
          <p className="text-sm text-muted-foreground">إنشاء حسابات المطابع وضبط أسعار الجملة</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="rounded-xl gap-1.5 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          إضافة مطبعة جديدة
        </Button>
      </div>

      {/* Global pricing panel */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => setExpanded(expanded === 'global' ? null : 'global')}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        >
          <span className="flex items-center gap-2 font-bold text-foreground">
            <Percent className="w-4 h-4 text-primary" />
            الأسعار العامة (كل المطابع)
          </span>
          {expanded === 'global' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {expanded === 'global' && (
          <div className="p-4 pt-0 space-y-4">
            {/* Default discount */}
            <div className="bg-muted/30 rounded-xl p-3 flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-sm font-bold text-foreground mb-1.5 block">الخصم الافتراضي لكل المنتجات (%)</Label>
                <Input
                  type="number" min={0} max={100} value={globalDefault}
                  onChange={e => setGlobalDefault(Number(e.target.value))}
                />
              </div>
              <Button onClick={saveGlobalDefault} className="rounded-xl">حفظ</Button>
            </div>

            {/* Per-product (all resellers) */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">تخصيص حسب المنتج (يطبّق على كل المطابع)</p>
              {products.map(s => (
                <ServiceOverrideRow
                  key={s.id}
                  service={s}
                  overrides={overrides}
                  resellerId={null}
                  onSave={(t, v) => saveOverride(null, s.id, t, v)}
                  onClear={() => clearOverride(null, s.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Resellers list */}
      {resellers.length === 0 ? (
        <div className="text-center py-12">
          <Store className="w-14 h-14 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">لا توجد مطابع بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resellers.map(r => (
            <div key={r.user_id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{r.shop_name}</h4>
                      <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                        {r.login_phone && <span dir="ltr" className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.login_phone}</span>}
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.shop_phone}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.shop_address}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="h-8 text-xs rounded-lg gap-1.5"
                    onClick={() => setExpanded(expanded === r.user_id ? null : r.user_id)}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    أسعار خاصة
                    {expanded === r.user_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
              {expanded === r.user_id && (
                <div className="border-t border-border bg-muted/20 p-4 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">
                    أسعار خاصة بهذه المطبعة (تتجاوز الأسعار العامة)
                  </p>
                  {products.map(s => (
                    <ServiceOverrideRow
                      key={s.id}
                      service={s}
                      overrides={overrides}
                      resellerId={r.user_id}
                      onSave={(t, v) => saveOverride(r.user_id, s.id, t, v)}
                      onClear={() => clearOverride(r.user_id, s.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مطبعة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm mb-1.5 block">اسم المطبعة *</Label>
              <Input value={form.shop_name} onChange={e => setForm({ ...form, shop_name: e.target.value })} placeholder="مطبعة النور" />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">رقم الهاتف (للدخول) *</Label>
              <Input dir="ltr" className="text-left" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="07xxxxxxxxx" />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">كلمة المرور *</Label>
              <Input type="password" dir="ltr" className="text-left" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="6 أحرف على الأقل" />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">رقم المطبعة *</Label>
              <Input dir="ltr" className="text-left" value={form.shop_phone} onChange={e => setForm({ ...form, shop_phone: e.target.value })} placeholder="07xxxxxxxxx" />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">عنوان المطبعة *</Label>
              <Input value={form.shop_address} onChange={e => setForm({ ...form, shop_address: e.target.value })} placeholder="بغداد - الكرادة" />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row-reverse gap-2">
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء الحساب'}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** One product row inside a pricing panel: shows base + effective price and an editor. */
const ServiceOverrideRow = ({
  service, overrides, resellerId, onSave, onClear,
}: {
  service: DbService;
  overrides: ResellerPriceOverride[];
  resellerId: string | null;
  onSave: (type: 'percent' | 'fixed', value: number) => void;
  onClear: () => void;
}) => {
  const exact = findExact(overrides, resellerId, service.id);
  const [mode, setMode] = useState<'default' | 'percent' | 'fixed'>(exact ? exact.price_type : 'default');
  const [value, setValue] = useState<number>(exact ? exact.value : 0);

  // Keep local state in sync if the underlying override changes (after reload)
  useEffect(() => {
    setMode(exact ? exact.price_type : 'default');
    setValue(exact ? exact.value : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exact?.id, exact?.price_type, exact?.value]);

  const effective = computeResellerPrice(
    { id: service.id, price: service.price }, overrides, resellerId,
  );

  return (
    <div className="bg-card rounded-lg border border-border/60 p-2.5 flex items-center gap-2 flex-wrap">
      <div className="flex-1 min-w-[120px]">
        <p className="text-sm font-semibold text-foreground">{service.label}</p>
        <p className="text-xs text-muted-foreground">
          الأساس {formatIQD(service.price)} ← <span className="text-primary font-bold">{formatIQD(effective.unitPrice)}</span>
          {exact ? <Badge variant="secondary" className="mr-1 text-[10px]">خاص</Badge> : null}
        </p>
      </div>
      <Select value={mode} onValueChange={(v) => setMode(v as 'default' | 'percent' | 'fixed')}>
        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="default">افتراضي</SelectItem>
          <SelectItem value="percent">نسبة %</SelectItem>
          <SelectItem value="fixed">سعر ثابت</SelectItem>
        </SelectContent>
      </Select>
      {mode !== 'default' && (
        <Input
          type="number" min={0} value={value}
          onChange={e => setValue(Number(e.target.value))}
          className="w-24 h-8 text-xs text-center"
          placeholder={mode === 'percent' ? '%' : 'د.ع'}
        />
      )}
      {mode === 'default' ? (
        exact ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs text-destructive border-destructive/30">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>الرجوع للسعر الافتراضي</AlertDialogTitle>
                <AlertDialogDescription>سيُحذف السعر الخاص لـ {service.label}.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col-reverse sm:flex-row-reverse gap-2">
                <AlertDialogCancel>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={onClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null
      ) : (
        <Button size="sm" className="h-8 text-xs" onClick={() => onSave(mode, value)}>حفظ</Button>
      )}
    </div>
  );
};

export default AdminResellers;
