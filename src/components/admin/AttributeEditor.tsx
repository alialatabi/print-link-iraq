import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VariantAttribute, AttributeOption } from '@/types/variants';

/**
 * Controlled editor for `services.variant_attributes` — product-wide customer
 * choices (stamp ink color; bag color → dependent ink colors). Attribute order
 * in the array IS the cascade order: an option's `allows` can only restrict
 * attributes that come AFTER it. Sibling of AiFieldsEditor (same value/onChange
 * shape), lives inside VariantManager's "الخيارات" tab which owns the Save button.
 */

interface AttributeEditorProps {
  attributes: VariantAttribute[];
  onChange: (next: VariantAttribute[]) => void;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/_{2,}/g, '_');

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/** Toggle `optionId` (of `laterAttr`) in/out of `opt`'s allowed set for `laterAttr`.
 * Absent key = allow all; we omit the key again once the set covers everything
 * (or nothing), matching the "empty = allows all" convention. */
function toggleAllow(
  opt: AttributeOption,
  laterAttr: VariantAttribute,
  optionId: string,
): Pick<AttributeOption, 'allows'> {
  const allIds = laterAttr.options.map(o => o.id);
  const current = opt.allows?.[laterAttr.id];
  const effective = current ?? allIds;
  const next = effective.includes(optionId)
    ? effective.filter(id => id !== optionId)
    : [...effective, optionId];
  const nextAllows = { ...(opt.allows ?? {}) };
  if (next.length === 0 || next.length === allIds.length) {
    delete nextAllows[laterAttr.id];
  } else {
    nextAllows[laterAttr.id] = next;
  }
  return { allows: Object.keys(nextAllows).length ? nextAllows : undefined };
}

/** Strip any reference to `removedAttrId` from every option's `allows` (attribute deleted). */
function pruneAttributeRefs(attributes: VariantAttribute[], removedAttrId: string): VariantAttribute[] {
  return attributes.map(a => ({
    ...a,
    options: a.options.map(o => {
      if (!o.allows || !(removedAttrId in o.allows)) return o;
      const allows = { ...o.allows };
      delete allows[removedAttrId];
      return { ...o, allows: Object.keys(allows).length ? allows : undefined };
    }),
  }));
}

/** Strip any reference to `removedOptionId` from every `allows[...]` array (option deleted). */
function pruneOptionRefs(attributes: VariantAttribute[], removedOptionId: string): VariantAttribute[] {
  return attributes.map(a => ({
    ...a,
    options: a.options.map(o => {
      if (!o.allows) return o;
      const allows: Record<string, string[]> = {};
      for (const [attrId, ids] of Object.entries(o.allows)) {
        const filtered = ids.filter(id => id !== removedOptionId);
        if (filtered.length) allows[attrId] = filtered;
      }
      return { ...o, allows: Object.keys(allows).length ? allows : undefined };
    }),
  }));
}

const AttributeEditor = ({ attributes, onChange }: AttributeEditorProps) => {
  const updateAttribute = (idx: number, patch: Partial<VariantAttribute>) =>
    onChange(attributes.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const addAttribute = () =>
    onChange([...attributes, { id: newId('attr'), label: '', options: [] }]);

  const removeAttribute = (idx: number) => {
    const removed = attributes[idx];
    const rest = attributes.filter((_, i) => i !== idx);
    onChange(pruneAttributeRefs(rest, removed.id));
  };

  const moveAttribute = (idx: number, dir: -1 | 1) => {
    const swap = idx + dir;
    if (swap < 0 || swap >= attributes.length) return;
    const next = [...attributes];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  const updateOption = (attrIdx: number, optIdx: number, patch: Partial<AttributeOption>) =>
    onChange(attributes.map((a, i) => (
      i === attrIdx
        ? { ...a, options: a.options.map((o, j) => (j === optIdx ? { ...o, ...patch } : o)) }
        : a
    )));

  const addOption = (attrIdx: number) =>
    onChange(attributes.map((a, i) => (
      i === attrIdx ? { ...a, options: [...a.options, { id: newId('opt'), label: '' }] } : a
    )));

  const removeOption = (attrIdx: number, optIdx: number) => {
    const removed = attributes[attrIdx].options[optIdx];
    const next = attributes.map((a, i) => (
      i === attrIdx ? { ...a, options: a.options.filter((_, j) => j !== optIdx) } : a
    ));
    onChange(pruneOptionRefs(next, removed.id));
  };

  const moveOption = (attrIdx: number, optIdx: number, dir: -1 | 1) => {
    const attr = attributes[attrIdx];
    const swap = optIdx + dir;
    if (swap < 0 || swap >= attr.options.length) return;
    const nextOptions = [...attr.options];
    [nextOptions[optIdx], nextOptions[swap]] = [nextOptions[swap], nextOptions[optIdx]];
    updateAttribute(attrIdx, { options: nextOptions });
  };

  return (
    <div className="space-y-3">
      {attributes.length === 0 && (
        <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3 border border-border/50">
          لا توجد خيارات لهذا المنتج بعد (مثال: لون الحبر، لون الكيس...).
        </p>
      )}
      {attributes.map((attr, idx) => {
        const laterAttrs = attributes.slice(idx + 1);
        return (
          <div key={attr.id} className="rounded-xl border border-border p-3 space-y-2.5 bg-card">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveAttribute(idx, -1)}
                  className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:text-foreground"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === attributes.length - 1}
                  onClick={() => moveAttribute(idx, 1)}
                  className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:text-foreground"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <Input
                value={attr.label}
                onChange={e => updateAttribute(idx, { label: e.target.value })}
                placeholder="اسم الخاصية (لون الحبر)"
                className="rounded-lg h-9 text-sm min-w-[110px] flex-1"
              />
              <Input
                value={attr.id}
                onChange={e => updateAttribute(idx, { id: slugify(e.target.value) })}
                placeholder="ink_color"
                dir="ltr"
                className="rounded-lg h-9 text-xs w-24 shrink-0 font-mono"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 p-0 text-destructive shrink-0"
                onClick={() => removeAttribute(idx)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="space-y-2 pr-6">
              {attr.options.map((opt, optIdx) => (
                <div key={opt.id} className="rounded-lg border border-border/60 bg-muted/20 p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={optIdx === 0}
                        onClick={() => moveOption(idx, optIdx, -1)}
                        className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:text-foreground"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={optIdx === attr.options.length - 1}
                        onClick={() => moveOption(idx, optIdx, 1)}
                        className="h-6 w-6 flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:text-foreground"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <Input
                      value={opt.label}
                      onChange={e => updateOption(idx, optIdx, { label: e.target.value })}
                      placeholder="أزرق"
                      className="rounded-lg h-8 text-sm min-w-[100px] flex-1"
                    />
                    <Input
                      value={opt.id}
                      onChange={e => updateOption(idx, optIdx, { id: slugify(e.target.value) })}
                      placeholder="blue"
                      dir="ltr"
                      className="rounded-lg h-8 text-xs w-20 shrink-0 font-mono"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive shrink-0"
                      onClick={() => removeOption(idx, optIdx)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {laterAttrs.map(laterAttr => {
                    const effective = opt.allows?.[laterAttr.id] ?? laterAttr.options.map(o => o.id);
                    return (
                      <div key={laterAttr.id} className="pr-5">
                        <p className="text-[10px] text-muted-foreground mb-1">
                          يسمح بـ «{laterAttr.label || laterAttr.id}»:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {laterAttr.options.length === 0 && (
                            <span className="text-[10px] text-muted-foreground/60">لا توجد خيارات بعد</span>
                          )}
                          {laterAttr.options.map(lo => {
                            const checked = effective.includes(lo.id);
                            return (
                              <button
                                key={lo.id}
                                type="button"
                                onClick={() => updateOption(idx, optIdx, toggleAllow(opt, laterAttr, lo.id))}
                                className={cn(
                                  'px-2.5 py-1.5 rounded-full text-[11px] border transition-colors',
                                  checked
                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                    : 'border-input text-muted-foreground',
                                )}
                              >
                                {lo.label || '—'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => addOption(idx)}
                className="w-full rounded-lg h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5 ml-1" /> إضافة خيار
              </Button>
            </div>
          </div>
        );
      })}
      <Button size="sm" variant="outline" onClick={addAttribute} className="w-full rounded-xl">
        <Plus className="w-4 h-4 ml-1" /> إضافة خاصية جديدة
      </Button>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        اترك كل خيارات «يسمح بـ» بدون تحديد للسماح بجميع الخيارات دائماً — استخدمها فقط لتقييد خيارات لاحقة (مثال: كيس أزرق → حبر أزرق وأسود فقط).
      </p>
    </div>
  );
};

export default AttributeEditor;
