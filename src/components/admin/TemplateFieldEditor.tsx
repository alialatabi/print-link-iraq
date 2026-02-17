import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Move, Type } from 'lucide-react';

export interface TextField {
  key: string;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize: number;
  fontColor: string;
  fontWeight: string;
  textAlign: string;
  maxWidth: number; // percentage
  placeholder: string;
}

const DEFAULT_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'name', label: 'الاسم', placeholder: 'أحمد محمد' },
  { key: 'phone', label: 'رقم الهاتف', placeholder: '0770 123 4567' },
  { key: 'job_title', label: 'المسمى الوظيفي', placeholder: 'مدير تسويق' },
  { key: 'email', label: 'البريد الإلكتروني', placeholder: 'ahmed@mail.com' },
  { key: 'address', label: 'العنوان', placeholder: 'بغداد - الكرادة' },
  { key: 'company', label: 'اسم الشركة', placeholder: 'شركة النور' },
  { key: 'website', label: 'الموقع', placeholder: 'www.example.com' },
  { key: 'custom1', label: 'حقل مخصص 1', placeholder: 'نص مخصص' },
  { key: 'custom2', label: 'حقل مخصص 2', placeholder: 'نص مخصص' },
];

interface TemplateFieldEditorProps {
  imageUrl: string;
  fields: TextField[];
  onChange: (fields: TextField[]) => void;
}

const TemplateFieldEditor = ({ imageUrl, fields, onChange }: TemplateFieldEditorProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedField, setSelectedField] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newFieldKey, setNewFieldKey] = useState('name');
  const [newFieldLabel, setNewFieldLabel] = useState('');

  const usedKeys = fields.map(f => f.key);
  const availableFields = DEFAULT_FIELDS.filter(f => !usedKeys.includes(f.key));

  const addField = () => {
    const def = DEFAULT_FIELDS.find(f => f.key === newFieldKey);
    const label = newFieldLabel.trim() || def?.label || newFieldKey;
    const newField: TextField = {
      key: newFieldKey,
      label,
      x: 50,
      y: 30 + fields.length * 10,
      fontSize: 16,
      fontColor: '#000000',
      fontWeight: 'bold',
      textAlign: 'center',
      maxWidth: 60,
      placeholder: def?.placeholder || label,
    };
    onChange([...fields, newField]);
    setAddDialogOpen(false);
    setNewFieldLabel('');
    setSelectedField(fields.length);
  };

  const removeField = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
    setSelectedField(null);
  };

  const updateField = (idx: number, updates: Partial<TextField>) => {
    onChange(fields.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const handleMouseDown = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(idx);
    setSelectedField(idx);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging === null || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updateField(dragging, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  }, [dragging, fields]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const sel = selectedField !== null ? fields[selectedField] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Type className="w-4 h-4 text-primary" />
          حقول النص ({fields.length})
        </h4>
        <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => setAddDialogOpen(true)} disabled={availableFields.length === 0}>
          <Plus className="w-3 h-3 ml-1" />
          إضافة حقل
        </Button>
      </div>

      {/* Canvas with image and fields */}
      <div
        ref={canvasRef}
        className="relative border border-border rounded-xl overflow-hidden bg-muted/30 select-none"
        style={{ cursor: dragging !== null ? 'grabbing' : 'default' }}
        onClick={() => setSelectedField(null)}
      >
        <img src={imageUrl} alt="template" className="w-full pointer-events-none" draggable={false} />

        {fields.map((field, idx) => (
          <div
            key={idx}
            className={`absolute cursor-grab active:cursor-grabbing transition-shadow ${
              selectedField === idx ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-1 hover:ring-primary/50'
            }`}
            style={{
              left: `${field.x}%`,
              top: `${field.y}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${field.fontSize}px`,
              color: field.fontColor,
              fontWeight: field.fontWeight,
              textAlign: field.textAlign as any,
              maxWidth: `${field.maxWidth}%`,
              whiteSpace: 'nowrap',
              textShadow: '0 0 3px rgba(255,255,255,0.8)',
            }}
            onMouseDown={(e) => handleMouseDown(idx, e)}
            onClick={(e) => { e.stopPropagation(); setSelectedField(idx); }}
          >
            <div className="bg-background/60 backdrop-blur-sm rounded px-1.5 py-0.5 border border-border/50">
              <span className="text-[10px] text-muted-foreground block leading-none mb-0.5">{field.label}</span>
              <span style={{ fontSize: `${Math.min(field.fontSize, 18)}px`, color: field.fontColor, fontWeight: field.fontWeight }}>
                {field.placeholder}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Field properties panel */}
      {sel && selectedField !== null && (
        <div className="bg-muted/30 rounded-xl p-3 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">{sel.label}</span>
            <Button size="sm" variant="destructive" className="h-7 text-[10px] rounded" onClick={() => removeField(selectedField)}>
              <Trash2 className="w-3 h-3 ml-1" />
              حذف
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">حجم الخط</label>
              <Input type="number" value={sel.fontSize} onChange={e => updateField(selectedField, { fontSize: parseInt(e.target.value) || 16 })} className="h-8 text-xs rounded" min="8" max="72" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">لون الخط</label>
              <div className="flex gap-1">
                <input type="color" value={sel.fontColor} onChange={e => updateField(selectedField, { fontColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={sel.fontColor} onChange={e => updateField(selectedField, { fontColor: e.target.value })} className="h-8 text-xs rounded flex-1" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">سمك الخط</label>
              <Select value={sel.fontWeight} onValueChange={v => updateField(selectedField, { fontWeight: v })}>
                <SelectTrigger className="h-8 text-xs rounded"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">عادي</SelectItem>
                  <SelectItem value="bold">سميك</SelectItem>
                  <SelectItem value="lighter">خفيف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">المحاذاة</label>
              <Select value={sel.textAlign} onValueChange={v => updateField(selectedField, { textAlign: v })}>
                <SelectTrigger className="h-8 text-xs rounded"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="center">وسط</SelectItem>
                  <SelectItem value="right">يمين</SelectItem>
                  <SelectItem value="left">يسار</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">العرض الأقصى %</label>
              <Input type="number" value={sel.maxWidth} onChange={e => updateField(selectedField, { maxWidth: parseInt(e.target.value) || 60 })} className="h-8 text-xs rounded" min="10" max="100" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">نص تجريبي</label>
              <Input value={sel.placeholder} onChange={e => updateField(selectedField, { placeholder: e.target.value })} className="h-8 text-xs rounded" />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Move className="w-3 h-3" />
            اسحب الحقل بالماوس لتغيير موقعه
          </p>
        </div>
      )}

      {/* Field list */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedField(idx)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                selectedField === idx
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Add field dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">إضافة حقل نص</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">نوع الحقل</label>
              <Select value={newFieldKey} onValueChange={setNewFieldKey}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableFields.map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">اسم مخصص (اختياري)</label>
              <Input value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} placeholder="اتركه فارغاً للاسم الافتراضي" className="rounded-lg" />
            </div>
            <Button onClick={addField} className="w-full rounded-lg">إضافة</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplateFieldEditor;
