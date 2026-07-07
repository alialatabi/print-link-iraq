import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, Ruler, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUserFriendlyError } from '@/lib/errors';
import { useServices } from '@/hooks/useServices';
import { useServiceVariants } from '@/hooks/useVariants';
import { tierQtyLabel, type ServiceVariant, type VariantTier, type VariantAttribute } from '@/types/variants';
import AttributeEditor from '@/components/admin/AttributeEditor';

/**
 * Admin editor for one sub-service's `service_variants` (sizes/shapes, each
 * with an admin-enumerated qty→price tier list) and `services.variant_attributes`
 * (product-wide choices like ink color). Opened from the "القياسات والأسعار"
 * button on a sub-service row in ServicesTabContent.
 *
 * `as never` casts throughout: the generated Supabase types don't know
 * `service_variants` / `services.variant_attributes` yet (see useVariants.ts).
 */

interface VariantManagerProps {
  serviceId: string;
  serviceLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VariantDraft {
  id: string | null;
  label: string;
  group_label: string;
  size_label: string;
  unit_label: string;
  faces: '' | '1' | '2';
  active: boolean;
  tiers: VariantTier[];
}

const emptyDraft = (): VariantDraft => ({
  id: null, label: '', group_label: '', size_label: '', unit_label: '', faces: '', active: true, tiers: [],
});

const draftFromVariant = (v: ServiceVariant): VariantDraft => ({
  id: v.id,
  label: v.label,
  group_label: v.group_label ?? '',
  size_label: v.size_label ?? '',
  unit_label: v.unit_label ?? '',
  faces: v.faces === 2 ? '2' : v.faces === 1 ? '1' : '',
  active: v.active,
  tiers: v.tiers.map(t => ({ ...t })),
});

const toInt = (v: string): number => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};
const toOptionalInt = (v: string): number | undefined => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Validate a variant draft before save; returns an Arabic error message, or null if valid. */
const validateDraft = (d: VariantDraft): string | null => {
  if (!d.label.trim()) return 'عنوان القياس مطلوب';
  if (d.tiers.length === 0) return 'أضف كمية سعرية واحدة على الأقل';
  const seen = new Set<number>();
  for (const t of d.tiers) {
    if (!t.qty || t.qty <= 0) return 'كل كمية يجب أن تكون أكبر من صفر';
    if (t.price < 0) return 'السعر يجب أن لا يكون سالباً';
    if (seen.has(t.qty)) return 'الكميات يجب أن تكون فريدة (بدون تكرار)';
    seen.add(t.qty);
  }
  return null;
};

const VariantManager = ({ serviceId, serviceLabel, open, onOpenChange }: VariantManagerProps) => {
  const queryClient = useQueryClient();
  const { services } = useServices();
  const { variants } = useServiceVariants();

  const service = useMemo(() => services.find(s => s.id === serviceId), [services, serviceId]);
  const myVariants = useMemo(
    () => variants.filter(v => v.service_id === serviceId).sort((a, b) => a.sort_order - b.sort_order),
    [variants, serviceId],
  );

  const [draft, setDraft] = useState<VariantDraft | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);

  const [attrsDraft, setAttrsDraft] = useState<VariantAttribute[]>([]);
  const [savingAttrs, setSavingAttrs] = useState(false);
  const attrsInitRef = useRef(false);

  // Reset the variant edit form whenever the dialog (re)opens.
  useEffect(() => {
    if (open) setDraft(null);
  }, [open]);

  // Load variant_attributes into the editable draft once per open session, as
  // soon as the service row is available — later catalog refetches (e.g. from
  // saving the sizes tab) must NOT clobber in-progress edits on this tab.
  useEffect(() => {
    if (!open) { attrsInitRef.current = false; return; }
    if (!attrsInitRef.current && service) {
      setAttrsDraft(service.variant_attributes ?? []);
      attrsInitRef.current = true;
    }
  }, [open, service]);

  const invalidateVariants = () => queryClient.invalidateQueries({ queryKey: ['service_variants'] });
  const invalidateServices = () => queryClient.invalidateQueries({ queryKey: ['services'] });

  const handleSaveVariant = async () => {
    if (!draft) return;
    const err = validateDraft(draft);
    if (err) { toast.error(err); return; }
    setSavingVariant(true);
    try {
      const cleanTiers = draft.tiers.map(t => ({
        qty: t.qty,
        price: t.price,
        ...(t.cost ? { cost: t.cost } : {}),
        ...(t.gift ? { gift: t.gift } : {}),
      }));
      const payload = {
        service_id: serviceId,
        label: draft.label.trim(),
        group_label: draft.group_label.trim() || null,
        size_label: draft.size_label.trim() || null,
        unit_label: draft.unit_label.trim() || null,
        faces: draft.faces ? Number(draft.faces) : null,
        active: draft.active,
        tiers: cleanTiers,
      };
      if (draft.id) {
        const { error } = await supabase
          .from('service_variants' as never)
          .update(payload as never)
          .eq('id', draft.id);
        if (error) throw error;
        toast.success('تم تحديث القياس');
      } else {
        const maxOrder = myVariants.length ? Math.max(...myVariants.map(v => v.sort_order)) : 0;
        const { error } = await supabase
          .from('service_variants' as never)
          .insert({ id: crypto.randomUUID(), ...payload, sort_order: maxOrder + 1 } as never);
        if (error) throw error;
        toast.success('تمت إضافة القياس');
      }
      setDraft(null);
      invalidateVariants();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = async (v: ServiceVariant) => {
    if (!confirm(`حذف القياس "${v.label}"؟`)) return;
    try {
      const { error } = await supabase.from('service_variants' as never).delete().eq('id', v.id);
      if (error) throw error;
      toast.success('تم حذف القياس');
      if (draft?.id === v.id) setDraft(null);
      invalidateVariants();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
    }
  };

  const handleToggleActive = async (v: ServiceVariant, next: boolean) => {
    try {
      const { error } = await supabase.from('service_variants' as never).update({ active: next } as never).eq('id', v.id);
      if (error) throw error;
      invalidateVariants();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
    }
  };

  const handleMove = async (variantId: string, dir: -1 | 1) => {
    const idx = myVariants.findIndex(v => v.id === variantId);
    const swapIdx = idx + dir;
    if (idx === -1 || swapIdx < 0 || swapIdx >= myVariants.length) return;
    const a = myVariants[idx];
    const b = myVariants[swapIdx];
    try {
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('service_variants' as never).update({ sort_order: b.sort_order } as never).eq('id', a.id),
        supabase.from('service_variants' as never).update({ sort_order: a.sort_order } as never).eq('id', b.id),
      ]);
      if (e1 || e2) throw e1 || e2;
      invalidateVariants();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
    }
  };

  const handleSaveAttributes = async () => {
    for (const a of attrsDraft) {
      if (!a.id.trim() || !a.label.trim()) { toast.error('كل خاصية تحتاج معرّفاً واسماً'); return; }
      if (a.options.length === 0) { toast.error(`أضف خياراً واحداً على الأقل لـ "${a.label}"`); return; }
      for (const o of a.options) {
        if (!o.id.trim() || !o.label.trim()) { toast.error(`كل خيار في "${a.label}" يحتاج معرّفاً واسماً`); return; }
      }
      const optIds = a.options.map(o => o.id);
      if (new Set(optIds).size !== optIds.length) { toast.error(`معرّفات الخيارات يجب أن تكون فريدة في "${a.label}"`); return; }
    }
    const attrIds = attrsDraft.map(a => a.id);
    if (new Set(attrIds).size !== attrIds.length) { toast.error('معرّفات الخصائص يجب أن تكون فريدة'); return; }

    setSavingAttrs(true);
    try {
      const { error } = await supabase
        .from('services')
        .update({ variant_attributes: attrsDraft } as never)
        .eq('id', serviceId);
      if (error) throw error;
      toast.success('تم حفظ خيارات المنتج');
      invalidateServices();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
    } finally {
      setSavingAttrs(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">القياسات والأسعار — {serviceLabel}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="sizes" dir="rtl">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="sizes">القياسات</TabsTrigger>
            <TabsTrigger value="options">الخيارات</TabsTrigger>
          </TabsList>

          <TabsContent value="sizes" className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {myVariants.length > 0 ? `${myVariants.length} قياس` : 'لا توجد قياسات بعد'}
              </p>
              {!draft && (
                <Button size="sm" onClick={() => setDraft(emptyDraft())} className="rounded-xl w-full sm:w-auto">
                  <Plus className="w-4 h-4 ml-1" /> إضافة قياس
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
              {myVariants.map((v, idx) => (
                draft?.id === v.id ? (
                  <VariantEditForm
                    key={v.id}
                    draft={draft}
                    setDraft={setDraft}
                    onSave={handleSaveVariant}
                    onCancel={() => setDraft(null)}
                    saving={savingVariant}
                  />
                ) : (
                  <VariantRow
                    key={v.id}
                    variant={v}
                    disabledActions={!!draft}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < myVariants.length - 1}
                    onEdit={() => setDraft(draftFromVariant(v))}
                    onDelete={() => handleDeleteVariant(v)}
                    onToggleActive={next => handleToggleActive(v, next)}
                    onMoveUp={() => handleMove(v.id, -1)}
                    onMoveDown={() => handleMove(v.id, 1)}
                  />
                )
              ))}
              {draft && draft.id === null && (
                <VariantEditForm
                  draft={draft}
                  setDraft={setDraft}
                  onSave={handleSaveVariant}
                  onCancel={() => setDraft(null)}
                  saving={savingVariant}
                  isNew
                />
              )}
              {myVariants.length === 0 && !draft && (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3 border border-border/50 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 shrink-0" /> بدون قياسات، هذه الخدمة تعمل بالنظام القديم (سعر/كمية عامة).
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="options" className="space-y-3">
            <AttributeEditor attributes={attrsDraft} onChange={setAttrsDraft} />
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSaveAttributes} disabled={savingAttrs} className="flex-1 rounded-xl">
                {savingAttrs ? 'جاري الحفظ...' : 'حفظ الخيارات'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

interface VariantRowProps {
  variant: ServiceVariant;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabledActions: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const VariantRow = ({
  variant, canMoveUp, canMoveDown, disabledActions,
  onEdit, onDelete, onToggleActive, onMoveUp, onMoveDown,
}: VariantRowProps) => (
  <div
    className={cn(
      'rounded-xl border p-2.5 flex items-center gap-2 flex-wrap sm:flex-nowrap',
      variant.active ? 'bg-card border-border' : 'bg-muted/30 border-border/50 opacity-60',
    )}
  >
    <div className="flex flex-col gap-0.5 shrink-0">
      <button
        type="button"
        disabled={!canMoveUp || disabledActions}
        onClick={onMoveUp}
        className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:text-foreground"
      >
        <ArrowUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        disabled={!canMoveDown || disabledActions}
        onClick={onMoveDown}
        className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:text-foreground"
      >
        <ArrowDown className="w-3.5 h-3.5" />
      </button>
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        {variant.group_label && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
            {variant.group_label}
          </span>
        )}
        <h4 className="font-bold text-foreground text-sm truncate">{variant.label}</h4>
        {!variant.active && <span className="text-[10px] text-muted-foreground shrink-0">(غير مفعّل)</span>}
      </div>
      <div className="flex items-center gap-2 gap-y-0.5 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
        {variant.size_label && <span>{variant.size_label}</span>}
        <span>{variant.tiers.length.toLocaleString('en-US')} سعر</span>
        {variant.tiers[0] && (
          <span className="font-bold text-success">
            {tierQtyLabel(variant.tiers[0], variant.unit_label)} = {variant.tiers[0].price.toLocaleString('en-US')} د.ع
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end">
      <Switch checked={variant.active} onCheckedChange={onToggleActive} disabled={disabledActions} />
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onEdit} disabled={disabledActions}>
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={onDelete} disabled={disabledActions}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  </div>
);

interface VariantEditFormProps {
  draft: VariantDraft;
  setDraft: (d: VariantDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}

const VariantEditForm = ({ draft, setDraft, onSave, onCancel, saving, isNew }: VariantEditFormProps) => {
  const patch = (p: Partial<VariantDraft>) => setDraft({ ...draft, ...p });
  const updateTier = (idx: number, p: Partial<VariantTier>) =>
    patch({ tiers: draft.tiers.map((t, i) => (i === idx ? { ...t, ...p } : t)) });
  const addTier = () => patch({ tiers: [...draft.tiers, { qty: 0, price: 0 }] });
  const removeTier = (idx: number) => patch({ tiers: draft.tiers.filter((_, i) => i !== idx) });

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">العنوان * (مثال: A4، 6×4)</label>
          <Input value={draft.label} onChange={e => patch({ label: e.target.value })} className="rounded-lg h-10" placeholder="A4" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">المجموعة (اختياري — مثل شكل الختم)</label>
          <Input value={draft.group_label} onChange={e => patch({ group_label: e.target.value })} className="rounded-lg h-10" placeholder="مستطيل" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">القياس المعروض (اختياري)</label>
          <Input value={draft.size_label} onChange={e => patch({ size_label: e.target.value })} className="rounded-lg h-10" placeholder="21×29.7 سم" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">وحدة الكمية (اختياري — مثل دفتر)</label>
          <Input value={draft.unit_label} onChange={e => patch({ unit_label: e.target.value })} className="rounded-lg h-10" placeholder="دفتر" />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground mb-1 block">عدد الأوجه</label>
          <select
            value={draft.faces}
            onChange={e => patch({ faces: e.target.value as VariantDraft['faces'] })}
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">افتراضي الخدمة</option>
            <option value="1">وجه واحد</option>
            <option value="2">وجهان</option>
          </select>
        </div>
        <div className="flex items-center justify-between bg-card rounded-lg px-3 h-10 border border-border/60">
          <span className="text-sm font-medium text-foreground">مفعّل</span>
          <Switch checked={draft.active} onCheckedChange={v => patch({ active: v })} />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-foreground mb-1.5 block">الكميات والأسعار *</label>
        <div className="space-y-2">
          {draft.tiers.map((t, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2 bg-card rounded-lg p-2 border border-border/60">
              <div className="flex-1 min-w-[70px]">
                <label className="text-[10px] text-muted-foreground block mb-0.5">الكمية *</label>
                <Input
                  type="number" min="1" dir="ltr"
                  value={t.qty || ''}
                  onChange={e => updateTier(idx, { qty: toInt(e.target.value) })}
                  className="rounded-lg h-9 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="text-[10px] text-muted-foreground block mb-0.5">السعر *</label>
                <Input
                  type="number" min="0" dir="ltr"
                  value={t.price || ''}
                  onChange={e => updateTier(idx, { price: toInt(e.target.value) })}
                  className="rounded-lg h-9 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[80px]">
                <label className="text-[10px] text-muted-foreground block mb-0.5">التكلفة</label>
                <Input
                  type="number" min="0" dir="ltr"
                  value={t.cost || ''}
                  onChange={e => updateTier(idx, { cost: toOptionalInt(e.target.value) })}
                  className="rounded-lg h-9 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[70px]">
                <label className="text-[10px] text-muted-foreground block mb-0.5">هدية</label>
                <Input
                  type="number" min="0" dir="ltr"
                  value={t.gift || ''}
                  onChange={e => updateTier(idx, { gift: toOptionalInt(e.target.value) })}
                  className="rounded-lg h-9 text-sm"
                />
              </div>
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive shrink-0" onClick={() => removeTier(idx)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addTier} className="w-full rounded-lg">
            <Plus className="w-3.5 h-3.5 ml-1" /> إضافة كمية سعرية
          </Button>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} disabled={saving} className="flex-1 rounded-xl h-10">
          {saving ? 'جاري الحفظ...' : isNew ? 'إضافة' : 'حفظ'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving} className="rounded-xl h-10">
          إلغاء
        </Button>
      </div>
    </div>
  );
};

export default VariantManager;
