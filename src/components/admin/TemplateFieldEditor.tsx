import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Move, Type, ImageIcon, RotateCw } from 'lucide-react';

export interface TextField {
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontColor: string;
  fontWeight: string;
  textAlign: string;
  maxWidth: number;
  placeholder: string;
  fontFamily: string;
  rotation: number;
  letterSpacing: number;
  opacity: number;
  textDecoration: string;
  lineHeight: number;
  // New fields
  type?: 'text' | 'image'; // default 'text'
  width?: number;  // percentage for image fields
  height?: number; // percentage for image fields
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

const IMAGE_FIELDS: { key: string; label: string }[] = [
  { key: 'logo', label: 'شعار الشركة' },
  { key: 'photo', label: 'صورة شخصية' },
  { key: 'qr_code', label: 'رمز QR' },
  { key: 'image1', label: 'صورة مخصصة 1' },
  { key: 'image2', label: 'صورة مخصصة 2' },
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
  const [addType, setAddType] = useState<'text' | 'image'>('text');
  const [newFieldKey, setNewFieldKey] = useState('name');
  const [newFieldLabel, setNewFieldLabel] = useState('');

  const usedKeys = fields.map(f => f.key);
  const availableTextFields = DEFAULT_FIELDS.filter(f => !usedKeys.includes(f.key));
  const availableImageFields = IMAGE_FIELDS.filter(f => !usedKeys.includes(f.key));

  const openAddDialog = (type: 'text' | 'image') => {
    setAddType(type);
    if (type === 'text') {
      setNewFieldKey(availableTextFields[0]?.key || 'custom1');
    } else {
      setNewFieldKey(availableImageFields[0]?.key || 'image1');
    }
    setNewFieldLabel('');
    setAddDialogOpen(true);
  };

  const addField = () => {
    if (addType === 'text') {
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
        fontFamily: 'Cairo',
        rotation: 0,
        letterSpacing: 0,
        opacity: 100,
        textDecoration: 'none',
        lineHeight: 1.3,
        type: 'text',
      };
      onChange([...fields, newField]);
    } else {
      const def = IMAGE_FIELDS.find(f => f.key === newFieldKey);
      const label = newFieldLabel.trim() || def?.label || newFieldKey;
      const newField: TextField = {
        key: newFieldKey,
        label,
        x: 50,
        y: 50,
        fontSize: 16,
        fontColor: '#000000',
        fontWeight: 'normal',
        textAlign: 'center',
        maxWidth: 30,
        placeholder: label,
        fontFamily: 'Cairo',
        rotation: 0,
        letterSpacing: 0,
        opacity: 100,
        textDecoration: 'none',
        lineHeight: 1,
        type: 'image',
        width: 20,
        height: 20,
      };
      onChange([...fields, newField]);
    }
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
    // Inline updateField to keep deps stable (onChange + fields already cover what updateField used)
    onChange(fields.map((f, i) => i === dragging ? { ...f, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : f));
  }, [dragging, fields, onChange]);

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
  const isImageField = sel?.type === 'image';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Type className="w-4 h-4 text-primary" />
          الحقول ({fields.length})
        </h4>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => openAddDialog('text')} disabled={availableTextFields.length === 0}>
            <Plus className="w-3 h-3 ml-1" />
            حقل نص
          </Button>
          <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => openAddDialog('image')} disabled={availableImageFields.length === 0}>
            <ImageIcon className="w-3 h-3 ml-1" />
            حقل صورة
          </Button>
        </div>
      </div>

      {/* Canvas with image and fields */}
      <div
        ref={canvasRef}
        className="relative border border-border rounded-xl overflow-hidden bg-muted/30 select-none"
        style={{ cursor: dragging !== null ? 'grabbing' : 'default' }}
        onClick={() => setSelectedField(null)}
      >
        <img src={imageUrl} alt="template" className="w-full pointer-events-none" draggable={false} />

        {fields.map((field, idx) => {
          const isImage = field.type === 'image';
          return (
            <div
              key={idx}
              className={`absolute cursor-grab active:cursor-grabbing transition-shadow ${
                selectedField === idx ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-1 hover:ring-primary/50'
              }`}
              style={{
                left: `${field.x}%`,
                top: `${field.y}%`,
                transform: `translate(-50%, -50%) rotate(${field.rotation || 0}deg)`,
                fontSize: isImage ? '14px' : `${field.fontSize}px`,
                color: field.fontColor,
                fontWeight: field.fontWeight,
                fontFamily: field.fontFamily || 'Cairo',
                textAlign: field.textAlign as CSSProperties['textAlign'],
                maxWidth: isImage ? undefined : `${field.maxWidth}%`,
                whiteSpace: 'nowrap',
                textShadow: isImage ? 'none' : '0 0 3px rgba(255,255,255,0.8)',
                letterSpacing: isImage ? undefined : `${field.letterSpacing || 0}px`,
                opacity: (field.opacity ?? 100) / 100,
                textDecoration: isImage ? 'none' : (field.textDecoration || 'none'),
                width: isImage ? `${field.width || 20}%` : undefined,
                height: isImage ? `${field.height || 20}%` : undefined,
              }}
              onMouseDown={(e) => handleMouseDown(idx, e)}
              onClick={(e) => { e.stopPropagation(); setSelectedField(idx); }}
            >
              {isImage ? (
                <div className="w-full h-full bg-primary/10 border-2 border-dashed border-primary/50 rounded-lg flex flex-col items-center justify-center gap-1">
                  <ImageIcon className="w-6 h-6 text-primary/60" />
                  <span className="text-[10px] text-primary font-medium">{field.label}</span>
                </div>
              ) : (
                <div className="bg-background/60 backdrop-blur-sm rounded px-1.5 py-0.5 border border-border/50">
                  <span className="text-[10px] text-muted-foreground block leading-none mb-0.5">{field.label}</span>
                  <span style={{ fontSize: `${Math.min(field.fontSize, 18)}px`, color: field.fontColor, fontWeight: field.fontWeight }}>
                    {field.placeholder}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Field properties panel */}
      {sel && selectedField !== null && (
        <div className="bg-muted/30 rounded-xl p-3 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              {isImageField ? <ImageIcon className="w-3.5 h-3.5 text-primary" /> : <Type className="w-3.5 h-3.5 text-primary" />}
              {sel.label}
              <span className="text-[10px] text-muted-foreground font-normal">({isImageField ? 'صورة' : 'نص'})</span>
            </span>
            <Button size="sm" variant="destructive" className="h-7 text-[10px] rounded" onClick={() => removeField(selectedField)}>
              <Trash2 className="w-3 h-3 ml-1" />
              حذف
            </Button>
          </div>

          {/* Rotation slider - shared for both types */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RotateCw className="w-3 h-3" /> الدوران
              </label>
              <span className="text-[10px] font-mono text-foreground">{sel.rotation || 0}°</span>
            </div>
            <Slider
              value={[sel.rotation || 0]}
              onValueChange={([v]) => updateField(selectedField, { rotation: v })}
              min={-180}
              max={180}
              step={1}
              className="w-full"
            />
          </div>

          {/* Opacity slider - shared */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-muted-foreground">الشفافية</label>
              <span className="text-[10px] font-mono text-foreground">{sel.opacity ?? 100}%</span>
            </div>
            <Slider
              value={[sel.opacity ?? 100]}
              onValueChange={([v]) => updateField(selectedField, { opacity: v })}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          {isImageField ? (
            /* Image-specific controls */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">العرض %</label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[sel.width || 20]}
                    onValueChange={([v]) => updateField(selectedField, { width: v })}
                    min={5}
                    max={80}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-mono w-8 text-left">{sel.width || 20}</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">الارتفاع %</label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[sel.height || 20]}
                    onValueChange={([v]) => updateField(selectedField, { height: v })}
                    min={5}
                    max={80}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-[10px] font-mono w-8 text-left">{sel.height || 20}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Text-specific controls */
            <div className="space-y-3">
              {/* Font size slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-muted-foreground">حجم الخط</label>
                  <span className="text-[10px] font-mono text-foreground">{sel.fontSize}px</span>
                </div>
                <Slider
                  value={[sel.fontSize]}
                  onValueChange={([v]) => updateField(selectedField, { fontSize: v })}
                  min={8}
                  max={72}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">لون الخط</label>
                  <div className="flex gap-1">
                    <input type="color" value={sel.fontColor} onChange={e => updateField(selectedField, { fontColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Input value={sel.fontColor} onChange={e => updateField(selectedField, { fontColor: e.target.value })} className="h-8 text-xs rounded flex-1" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">عائلة الخط</label>
                  <Select value={sel.fontFamily || 'Cairo'} onValueChange={v => updateField(selectedField, { fontFamily: v })}>
                    <SelectTrigger className="h-8 text-xs rounded"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cairo">Cairo</SelectItem>
                      <SelectItem value="Tajawal">Tajawal</SelectItem>
                      <SelectItem value="Amiri">Amiri</SelectItem>
                      <SelectItem value="Noto Kufi Arabic">Noto Kufi Arabic</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                      <SelectItem value="Georgia">Georgia</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <label className="text-[10px] text-muted-foreground">تزيين النص</label>
                  <Select value={sel.textDecoration || 'none'} onValueChange={v => updateField(selectedField, { textDecoration: v })}>
                    <SelectTrigger className="h-8 text-xs rounded"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون</SelectItem>
                      <SelectItem value="underline">خط سفلي</SelectItem>
                      <SelectItem value="line-through">خط وسطي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">العرض الأقصى %</label>
                  <Input type="number" value={sel.maxWidth} onChange={e => updateField(selectedField, { maxWidth: parseInt(e.target.value) || 60 })} className="h-8 text-xs rounded" min="10" max="100" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">تباعد الأحرف</label>
                  <Input type="number" value={sel.letterSpacing || 0} onChange={e => updateField(selectedField, { letterSpacing: parseFloat(e.target.value) || 0 })} className="h-8 text-xs rounded" min="-5" max="20" step="0.5" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">ارتفاع السطر</label>
                  <Input type="number" value={sel.lineHeight ?? 1.3} onChange={e => updateField(selectedField, { lineHeight: parseFloat(e.target.value) || 1.3 })} className="h-8 text-xs rounded" min="0.5" max="3" step="0.1" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">نص تجريبي</label>
                <Input value={sel.placeholder} onChange={e => updateField(selectedField, { placeholder: e.target.value })} className="h-8 text-xs rounded" />
              </div>
            </div>
          )}

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
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                selectedField === idx
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {f.type === 'image' ? <ImageIcon className="w-3 h-3" /> : <Type className="w-3 h-3" />}
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Add field dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {addType === 'text' ? 'إضافة حقل نص' : 'إضافة حقل صورة'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">نوع الحقل</label>
              <Select value={newFieldKey} onValueChange={setNewFieldKey}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {addType === 'text'
                    ? availableTextFields.map(f => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))
                    : availableImageFields.map(f => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))
                  }
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
