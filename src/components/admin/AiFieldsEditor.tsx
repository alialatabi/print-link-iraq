import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

/**
 * Controlled editor for a product's AI-design configuration (size type, orientation, size
 * options / free-text size, and design directives). Extracted from the old AdminAiProducts
 * so the same UI + save semantics can live inside the services sub-service dialog.
 *
 * Use `aiFieldsFromRow` to load a `services` row's `ai_*` columns into the form, and
 * `aiFieldsToRow` to derive the `ai_*` columns back out on save.
 */

export type Canvas = '1024x1024' | '1536x1024' | '1024x1536';
type SizeMode = 'fixed' | 'options' | 'custom';
type OrientationMode = 'fixed' | 'choice';

export interface AiOptionRow { id: string; label: string; sizeLabel: string; canvas: Canvas; }

export interface AiFieldsValue {
  canvas: Canvas;
  sizeMode: SizeMode;
  orientationMode: OrientationMode;
  size_label: string;
  option_label: string;
  options: AiOptionRow[];
  custom_label: string;
  custom_placeholder: string;
  directives: string;
}

/** The `ai_*` columns persisted on a `services` row (minus ai_enabled / ai_fee). */
export interface AiFieldsRow {
  ai_canvas: Canvas;
  ai_size_label: string | null;
  ai_option_label: string | null;
  ai_options: AiOptionRow[];
  ai_custom_size: { label: string; placeholder: string } | null;
  ai_directives: string | null;
}

const CANVAS_LABELS: Record<Canvas, string> = {
  '1024x1024': 'مربع (1:1)',
  '1536x1024': 'أفقي (عرضي)',
  '1024x1536': 'عمودي (طولي)',
};

// Built-in orientation choices shown to the customer when the admin enables orientations.
// eslint-disable-next-line react-refresh/only-export-components -- utility constants co-located with this editor component
export const ORIENTATION_OPTIONS: AiOptionRow[] = [
  { id: 'landscape', label: 'بالعرض', sizeLabel: 'أفقي (عرضي)', canvas: '1536x1024' },
  { id: 'portrait', label: 'بالطول', sizeLabel: 'عمودي (طولي)', canvas: '1024x1536' },
];

const isOrientation = (opts: AiOptionRow[]) =>
  opts.length === 2 && opts.every((o) => o.id === 'landscape' || o.id === 'portrait');

const newOptionId = () => `o_${Math.random().toString(36).slice(2, 8)}`;

const CANVASES: Canvas[] = ['1024x1024', '1536x1024', '1024x1536'];
const asCanvas = (v: unknown): Canvas =>
  typeof v === 'string' && (CANVASES as string[]).includes(v) ? (v as Canvas) : '1024x1024';

/** Default (empty) AI-fields form state. */
// eslint-disable-next-line react-refresh/only-export-components
export const emptyAiFields = (): AiFieldsValue => ({
  canvas: '1024x1024',
  sizeMode: 'fixed',
  orientationMode: 'fixed',
  size_label: '',
  option_label: '',
  options: [],
  custom_label: '',
  custom_placeholder: '',
  directives: '',
});

/** Load a `services` row's `ai_*` columns into the editor form. */
// eslint-disable-next-line react-refresh/only-export-components
export function aiFieldsFromRow(row: Partial<AiFieldsRow> | null | undefined): AiFieldsValue {
  const rawOpts = Array.isArray(row?.ai_options) ? (row!.ai_options as unknown as Array<Record<string, unknown>>) : [];
  const options: AiOptionRow[] = rawOpts
    .filter((o) => o && typeof o.id === 'string')
    .map((o) => ({
      id: String(o.id),
      label: String(o.label ?? ''),
      sizeLabel: String(o.sizeLabel ?? ''),
      canvas: asCanvas(o.canvas),
    }));
  const cs = (row?.ai_custom_size as { label?: string; placeholder?: string } | null) || null;
  let sizeMode: SizeMode;
  let orientationMode: OrientationMode = 'fixed';
  if (isOrientation(options)) {
    orientationMode = 'choice';
    sizeMode = cs ? 'custom' : 'fixed';
  } else if (options.length > 0) {
    sizeMode = 'options';
  } else {
    sizeMode = cs ? 'custom' : 'fixed';
  }
  return {
    canvas: asCanvas(row?.ai_canvas),
    sizeMode,
    orientationMode,
    size_label: row?.ai_size_label || '',
    option_label: row?.ai_option_label || '',
    options,
    custom_label: cs?.label || '',
    custom_placeholder: cs?.placeholder || '',
    directives: row?.ai_directives || '',
  };
}

/** Derive the `ai_*` columns from the editor form, ready to persist on a `services` row. */
// eslint-disable-next-line react-refresh/only-export-components
export function aiFieldsToRow(v: AiFieldsValue): AiFieldsRow {
  const useSizeOptions = v.sizeMode === 'options';
  // Orientation choice only applies when the size isn't a per-size list (those carry their own orientation).
  const useOrientationChoice = !useSizeOptions && v.orientationMode === 'choice';
  return {
    ai_canvas: v.canvas,
    ai_size_label: v.sizeMode === 'fixed' ? (v.size_label.trim() || null) : null,
    ai_option_label: useSizeOptions ? (v.option_label.trim() || null) : useOrientationChoice ? 'الاتجاه' : null,
    ai_options: useSizeOptions
      ? v.options.map((o) => ({ id: o.id, label: o.label.trim(), sizeLabel: o.sizeLabel.trim(), canvas: o.canvas }))
      : useOrientationChoice ? ORIENTATION_OPTIONS : [],
    ai_custom_size: v.sizeMode === 'custom'
      ? { label: v.custom_label.trim(), placeholder: v.custom_placeholder.trim() }
      : null,
    ai_directives: v.directives.trim() || null,
  };
}

/** True when the current form has at least one valid size option (for save-time validation). */
// eslint-disable-next-line react-refresh/only-export-components
export const aiFieldsValid = (v: AiFieldsValue) => v.sizeMode !== 'options' || v.options.length > 0;

interface Props {
  value: AiFieldsValue;
  onChange: (next: AiFieldsValue) => void;
}

const AiFieldsEditor = ({ value, onChange }: Props) => {
  const patch = (p: Partial<AiFieldsValue>) => onChange({ ...value, ...p });
  const updateOption = (idx: number, p: Partial<AiOptionRow>) =>
    patch({ options: value.options.map((o, i) => (i === idx ? { ...o, ...p } : o)) });
  const addOption = () =>
    patch({ options: [...value.options, { id: newOptionId(), label: '', sizeLabel: '', canvas: value.canvas }] });
  const removeOption = (idx: number) => patch({ options: value.options.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4">
      {/* Size type — independent of orientation */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">نوع القياس</label>
        <select
          value={value.sizeMode}
          onChange={(e) => patch({ sizeMode: e.target.value as SizeMode })}
          className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="fixed">قياس ثابت (نص واحد)</option>
          <option value="options">قائمة قياسات / أنواع فرعية</option>
          <option value="custom">إدخال حر للقياس (يكتبه الزبون)</option>
        </select>
      </div>

      {/* Orientation — independent of size type. Only for non-list products. */}
      {value.sizeMode === 'options' ? (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed">
          الاتجاه يُحدَّد لكل قياس على حدة من القائمة أدناه.
        </div>
      ) : (
        <>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">الاتجاه</label>
            <select
              value={value.orientationMode}
              onChange={(e) => patch({ orientationMode: e.target.value as OrientationMode })}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="fixed">اتجاه ثابت</option>
              <option value="choice">يختار الزبون (طول / عرض)</option>
            </select>
          </div>
          {value.orientationMode === 'fixed' ? (
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الشكل</label>
              <select
                value={value.canvas}
                onChange={(e) => patch({ canvas: e.target.value as Canvas })}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
              >
                {(Object.keys(CANVAS_LABELS) as Canvas[]).map((c) => (
                  <option key={c} value={c}>{CANVAS_LABELS[c]}</option>
                ))}
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
      {value.sizeMode === 'fixed' && (
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">القياس (نص يظهر للزبون — اختياري)</label>
          <Input
            value={value.size_label}
            onChange={(e) => patch({ size_label: e.target.value })}
            placeholder="A5 (14.8×21 سم)"
            className="rounded-xl"
          />
        </div>
      )}

      {value.sizeMode === 'options' && (
        <div className="space-y-3 bg-muted/30 rounded-xl p-3 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">عنوان القائمة المنسدلة</label>
            <Input
              value={value.option_label}
              onChange={(e) => patch({ option_label: e.target.value })}
              placeholder="قياس الختم"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            {value.options.map((o, idx) => (
              <div key={o.id} className="bg-card rounded-lg p-2 border border-border/60 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={o.label}
                    onChange={(e) => updateOption(idx, { label: e.target.value })}
                    placeholder="الاسم (مثال: مستطيل 6×4)"
                    className="rounded-lg h-9 text-sm"
                  />
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive shrink-0" onClick={() => removeOption(idx)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={o.sizeLabel}
                    onChange={(e) => updateOption(idx, { sizeLabel: e.target.value })}
                    placeholder="القياس (مثال: 6×4 سم)"
                    className="rounded-lg h-9 text-sm"
                  />
                  <select
                    value={o.canvas}
                    onChange={(e) => updateOption(idx, { canvas: e.target.value as Canvas })}
                    className="h-9 rounded-lg border border-input bg-background px-2 text-xs shrink-0"
                    title="اتجاه/شكل هذا القياس"
                  >
                    {(Object.keys(CANVAS_LABELS) as Canvas[]).map((c) => (
                      <option key={c} value={c}>{CANVAS_LABELS[c]}</option>
                    ))}
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

      {value.sizeMode === 'custom' && (
        <div className="grid grid-cols-1 gap-3 bg-muted/30 rounded-xl p-3 border border-border/50">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">عنوان حقل القياس</label>
            <Input
              value={value.custom_label}
              onChange={(e) => patch({ custom_label: e.target.value })}
              placeholder="القياس المطلوب (الطول × العرض بالسنتيمتر)"
              className="rounded-xl"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">النص التوضيحي (placeholder)</label>
            <Input
              value={value.custom_placeholder}
              onChange={(e) => patch({ custom_placeholder: e.target.value })}
              placeholder="مثال: 10 × 5 سم"
              className="rounded-xl"
            />
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">توجيهات التصميم (تُضاف إلى أمر الذكاء الاصطناعي)</label>
        <Textarea
          value={value.directives}
          onChange={(e) => patch({ directives: e.target.value })}
          placeholder="مثال: ختم حبر باللون الأزرق فقط، نص كبير وواضح..."
          className="rounded-xl min-h-[70px]"
        />
      </div>
    </div>
  );
};

export default AiFieldsEditor;
