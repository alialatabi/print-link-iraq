import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Sparkles, X, GripVertical } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/errors';

type Canvas = '1024x1024' | '1536x1024' | '1024x1536';
type SizeMode = 'fixed' | 'options' | 'custom';
type OrientationMode = 'fixed' | 'choice';

interface OptionRow { id: string; label: string; sizeLabel: string; canvas: Canvas; }

interface AiProductRow {
  id: string;
  label: string;
  canvas: Canvas;
  size_label: string | null;
  option_label: string | null;
  options: OptionRow[];
  custom_size: { label: string; placeholder: string } | null;
  directives: string | null;
  price: number;
  sort_order: number;
  active: boolean;
}

const CANVAS_LABELS: Record<Canvas, string> = {
  '1024x1024': 'مربع (1:1)',
  '1536x1024': 'أفقي (عرضي)',
  '1024x1536': 'عمودي (طولي)',
};

// Built-in orientation choices shown to the customer when the admin enables orientations.
const ORIENTATION_OPTIONS: OptionRow[] = [
  { id: 'landscape', label: 'بالعرض', sizeLabel: 'أفقي (عرضي)', canvas: '1536x1024' },
  { id: 'portrait', label: 'بالطول', sizeLabel: 'عمودي (طولي)', canvas: '1024x1536' },
];
const isOrientation = (opts: OptionRow[]) =>
  opts.length === 2 && opts.every((o) => o.id === 'landscape' || o.id === 'portrait');

const emptyForm = {
  label: '', canvas: '1024x1024' as Canvas, price: 0, active: true, directives: '',
  sizeMode: 'fixed' as SizeMode, orientationMode: 'fixed' as OrientationMode, size_label: '',
  option_label: '', options: [] as OptionRow[],
  custom_label: '', custom_placeholder: '', sort_order: 0,
};

const newOptionId = () => `o_${Math.random().toString(36).slice(2, 8)}`;

const AdminAiProducts = () => {
  const [products, setProducts] = useState<AiProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('ai_products' as never).select('*').order('sort_order') as { data: AiProductRow[] | null };
    setProducts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, sort_order: products.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1 });
    setDialogOpen(true);
  };

  const openEdit = (p: AiProductRow) => {
    setEditingId(p.id);
    const opts = p.options || [];
    let sizeMode: SizeMode;
    let orientationMode: OrientationMode = 'fixed';
    if (isOrientation(opts)) {
      orientationMode = 'choice';
      sizeMode = p.custom_size ? 'custom' : 'fixed';
    } else if (opts.length > 0) {
      sizeMode = 'options';
    } else {
      sizeMode = p.custom_size ? 'custom' : 'fixed';
    }
    setForm({
      label: p.label, canvas: p.canvas, price: p.price, active: p.active,
      directives: p.directives || '', sizeMode, orientationMode, size_label: p.size_label || '',
      option_label: p.option_label || '', options: opts,
      custom_label: p.custom_size?.label || '', custom_placeholder: p.custom_size?.placeholder || '',
      sort_order: p.sort_order,
    });
    setDialogOpen(true);
  };

  const updateOption = (idx: number, patch: Partial<OptionRow>) =>
    setForm(f => ({ ...f, options: f.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }));
  const addOption = () =>
    setForm(f => ({ ...f, options: [...f.options, { id: newOptionId(), label: '', sizeLabel: '', canvas: f.canvas }] }));
  const removeOption = (idx: number) =>
    setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!form.label.trim()) { toast.error('اسم المنتج مطلوب'); return; }
    if (form.sizeMode === 'options' && form.options.length === 0) { toast.error('أضف قياساً واحداً على الأقل'); return; }

    const useSizeOptions = form.sizeMode === 'options';
    // Orientation choice only applies when the size isn't a per-size list (those carry their own orientation).
    const useOrientationChoice = !useSizeOptions && form.orientationMode === 'choice';

    const row = {
      label: form.label.trim(),
      canvas: form.canvas,
      price: form.price || 0,
      active: form.active,
      directives: form.directives.trim() || null,
      sort_order: form.sort_order || 0,
      size_label: form.sizeMode === 'fixed' ? (form.size_label.trim() || null) : null,
      option_label: useSizeOptions ? (form.option_label.trim() || null) : useOrientationChoice ? 'الاتجاه' : null,
      options: useSizeOptions
        ? form.options.map(o => ({ id: o.id, label: o.label.trim(), sizeLabel: o.sizeLabel.trim(), canvas: o.canvas }))
        : useOrientationChoice ? ORIENTATION_OPTIONS : [],
      custom_size: form.sizeMode === 'custom'
        ? { label: form.custom_label.trim(), placeholder: form.custom_placeholder.trim() }
        : null,
    };

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('ai_products' as never).update(row as never).eq('id', editingId);
        if (error) throw error;
        toast.success('تم تحديث المنتج');
      } else {
        // ID is generated automatically — the admin never types it.
        const { error } = await supabase.from('ai_products' as never).insert({ id: crypto.randomUUID(), ...row } as never);
        if (error) throw error;
        toast.success('تمت إضافة المنتج');
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: AiProductRow) => {
    if (!confirm(`حذف المنتج "${p.label}"؟ لن يظهر بعدها في صفحة التصميم بالذكاء الاصطناعي.`)) return;
    try {
      const { error } = await supabase.from('ai_products' as never).delete().eq('id', p.id);
      if (error) throw error;
      toast.success('تم حذف المنتج');
      load();
    } catch (err) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const toggleActive = async (p: AiProductRow) => {
    const { error } = await supabase.from('ai_products' as never).update({ active: !p.active } as never).eq('id', p.id);
    if (error) { toast.error('فشل التحديث'); return; }
    setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: !x.active } : x)));
  };

  // Drag-and-drop reordering (mirrors AdminServicesSpecs): reorder locally, then persist sort_order.
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const items = [...products];
    const from = items.findIndex(p => p.id === dragId);
    const to = items.findIndex(p => p.id === targetId);
    if (from === -1 || to === -1) { setDragId(null); return; }
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    const withOrder = items.map((p, idx) => ({ ...p, sort_order: idx + 1 }));
    setProducts(withOrder);
    setDragId(null);
    try {
      await Promise.all(withOrder.map(p =>
        supabase.from('ai_products' as never).update({ sort_order: p.sort_order } as never).eq('id', p.id)
      ));
      toast.success('تم تحديث الترتيب');
    } catch {
      toast.error('فشل حفظ الترتيب');
      load();
    }
  };

  const sizeSummary = (p: AiProductRow) => {
    if (isOrientation(p.options || [])) return 'اتجاهات (طول/عرض)';
    if ((p.options?.length ?? 0) > 0) return `${p.options.length} قياس`;
    if (p.custom_size) return 'إدخال حر للقياس';
    return p.size_label || CANVAS_LABELS[p.canvas];
  };

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            منتجات التصميم بالذكاء الاصطناعي
          </h3>
          <p className="text-sm text-muted-foreground">المنتجات التي يمكن للزبون تصميمها بالذكاء الاصطناعي — تحكّم بالقياسات والأنواع الفرعية والأسعار</p>
        </div>
        <Button onClick={openAdd} className="rounded-xl">
          <Plus className="w-4 h-4 ml-1" />
          إضافة منتج
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">لا توجد منتجات بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              draggable
              onDragStart={() => setDragId(p.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(p.id)}
              className={`bg-card rounded-xl p-4 border flex items-center gap-3 group cursor-grab active:cursor-grabbing transition-all ${p.active ? 'border-border' : 'border-destructive/30 opacity-60'} ${dragId === p.id ? 'opacity-50 scale-95' : ''}`}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/30 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-foreground text-sm">{p.label}</h4>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{p.price.toLocaleString('en-US')} د.ع</span>
                  {!p.active && <span className="text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">معطّل</span>}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground">{sizeSummary(p)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={p.active} onCheckedChange={() => toggleActive(p)} />
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(p)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(p)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل منتج' : 'إضافة منتج'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الاسم *</label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="مثال: تصميم ختم" className="rounded-xl" />
              <p className="text-[11px] text-muted-foreground mt-1">المعرّف (ID) يُنشأ تلقائياً.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">السعر (د.ع)</label>
              <Input type="number" min="0" value={form.price || ''} onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} placeholder="1000" className="rounded-xl" dir="ltr" />
            </div>

            {/* Size type — independent of orientation */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">نوع القياس</label>
              <select value={form.sizeMode} onChange={e => setForm(f => ({ ...f, sizeMode: e.target.value as SizeMode }))} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                <option value="fixed">قياس ثابت (نص واحد)</option>
                <option value="options">قائمة قياسات / أنواع فرعية</option>
                <option value="custom">إدخال حر للقياس (يكتبه الزبون)</option>
              </select>
            </div>

            {/* Orientation — independent of size type. Only for non-list products. */}
            {form.sizeMode === 'options' ? (
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
                الاتجاه يُحدَّد لكل قياس على حدة من القائمة أدناه.
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">الاتجاه</label>
                  <select value={form.orientationMode} onChange={e => setForm(f => ({ ...f, orientationMode: e.target.value as OrientationMode }))} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                    <option value="fixed">اتجاه ثابت</option>
                    <option value="choice">يختار الزبون (طول / عرض)</option>
                  </select>
                </div>
                {form.orientationMode === 'fixed' ? (
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">الشكل</label>
                    <select value={form.canvas} onChange={e => setForm(f => ({ ...f, canvas: e.target.value as Canvas }))} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                      {(Object.keys(CANVAS_LABELS) as Canvas[]).map(c => <option key={c} value={c}>{CANVAS_LABELS[c]}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
                    سيظهر للزبون خيار <span className="font-bold text-foreground">الاتجاه</span>: «بالطول» (عمودي) و«بالعرض» (أفقي).
                  </div>
                )}
              </>
            )}

            {/* Size-type-specific fields */}
            {form.sizeMode === 'fixed' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">القياس (نص يظهر للزبون — اختياري)</label>
                <Input value={form.size_label} onChange={e => setForm(f => ({ ...f, size_label: e.target.value }))} placeholder="A5 (14.8×21 سم)" className="rounded-xl" />
              </div>
            )}

            {form.sizeMode === 'options' && (
              <div className="space-y-3 bg-muted/30 rounded-xl p-3 border border-border/50">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">عنوان القائمة المنسدلة</label>
                  <Input value={form.option_label} onChange={e => setForm(f => ({ ...f, option_label: e.target.value }))} placeholder="قياس الختم" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  {form.options.map((o, idx) => (
                    <div key={o.id} className="bg-card rounded-lg p-2 border border-border/60 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input value={o.label} onChange={e => updateOption(idx, { label: e.target.value })} placeholder="الاسم (مثال: مستطيل 6×4)" className="rounded-lg h-9 text-sm" />
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive shrink-0" onClick={() => removeOption(idx)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input value={o.sizeLabel} onChange={e => updateOption(idx, { sizeLabel: e.target.value })} placeholder="القياس (مثال: 6×4 سم)" className="rounded-lg h-9 text-sm" />
                        <select value={o.canvas} onChange={e => updateOption(idx, { canvas: e.target.value as Canvas })} className="h-9 rounded-lg border border-input bg-background px-2 text-xs shrink-0" title="اتجاه/شكل هذا القياس">
                          {(Object.keys(CANVAS_LABELS) as Canvas[]).map(c => <option key={c} value={c}>{CANVAS_LABELS[c]}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addOption} className="w-full rounded-lg">
                    <Plus className="w-4 h-4 ml-1" /> إضافة قياس
                  </Button>
                </div>
              </div>
            )}

            {form.sizeMode === 'custom' && (
              <div className="grid grid-cols-1 gap-3 bg-muted/30 rounded-xl p-3 border border-border/50">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">عنوان حقل القياس</label>
                  <Input value={form.custom_label} onChange={e => setForm(f => ({ ...f, custom_label: e.target.value }))} placeholder="القياس المطلوب (الطول × العرض بالسنتيمتر)" className="rounded-xl" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">النص التوضيحي (placeholder)</label>
                  <Input value={form.custom_placeholder} onChange={e => setForm(f => ({ ...f, custom_placeholder: e.target.value }))} placeholder="مثال: 10 × 5 سم" className="rounded-xl" />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">توجيهات التصميم (تُضاف إلى أمر الذكاء الاصطناعي)</label>
              <Textarea value={form.directives} onChange={e => setForm(f => ({ ...f, directives: e.target.value }))} placeholder="مثال: ختم حبر باللون الأزرق فقط، نص كبير وواضح..." className="rounded-xl min-h-[70px]" />
            </div>

            <div className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
              <span className="text-sm font-medium text-foreground">مفعّل (يظهر للزبون)</span>
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
                {saving ? 'جاري الحفظ...' : editingId ? 'حفظ التغييرات' : 'إضافة'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="rounded-xl">إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAiProducts;
