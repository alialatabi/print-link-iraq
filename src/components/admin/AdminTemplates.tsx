import { useEffect, useState, useCallback, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useServices, useSpecializations } from '@/hooks/useServices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Upload, Image, Palette, X, Type } from 'lucide-react';
import TemplateFieldEditor, { type TextField } from './TemplateFieldEditor';
import { getUserFriendlyError } from '@/lib/errors';

interface Template {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  
  text_fields: TextField[];
  specializations: string[];
}

interface TemplateFormData {
  description: string;
  service_type: string;
  
  specializations: string[];
}

const AdminTemplates = () => {
  const { services } = useServices();
  const { specializations } = useSpecializations();
  const serviceLabels = Object.fromEntries(services.map(s => [s.id, s.label]));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterService, setFilterService] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState<TemplateFormData>({ description: '', service_type: 'business_card', specializations: [] });
  const [textFields, setTextFields] = useState<TextField[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewLocalUrl, setPreviewLocalUrl] = useState<string | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates((data as unknown as Template[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const openAdd = () => {
    setEditingTemplate(null);
    setForm({ description: '', service_type: 'business_card', specializations: [] });
    setTextFields([]);
    setPreviewFile(null);
    setPreviewLocalUrl(null);
    setShowFieldEditor(false);
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setForm({ description: t.description || '', service_type: t.service_type, specializations: t.specializations || [] });
    setTextFields(t.text_fields || []);
    setPreviewFile(null);
    setPreviewLocalUrl(t.preview_url);
    setShowFieldEditor(false);
    setDialogOpen(true);
  };

  const compressImageForPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 600;
            let width = img.width;
            let height = img.height;
            if (width > height && width > MAX_SIZE) {
              height = (height * MAX_SIZE) / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width = (width * MAX_SIZE) / height;
              height = MAX_SIZE;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject('Canvas error'); return; }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject('Image load error');
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject('File read error');
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن لا يتجاوز 20MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار ملف صورة فقط');
        return;
      }
      setUploading(true);
      setPreviewFile(file);
      await new Promise(resolve => setTimeout(resolve, 50));
      const compressedUrl = await compressImageForPreview(file);
      setPreviewLocalUrl(compressedUrl);
    } catch (error) {
      console.error('File selection error:', error);
      toast.error('حدث خطأ أثناء اختيار الصورة');
    } finally {
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadPreviewImage = async (templateId: string): Promise<string | null> => {
    if (!previewFile) return editingTemplate?.preview_url || null;

    try {
      setUploadStage('جاري تجهيز الصورة...');
      setUploadProgress(10);
      const ext = previewFile.name.split('.').pop();
      const filePath = `${templateId}.${ext}`;

      setUploadStage('جاري حذف الصورة القديمة...');
      setUploadProgress(20);
      await supabase.storage.from('template-previews').remove([filePath]);

      setUploadStage('جاري رفع الصورة...');
      setUploadProgress(40);

      const { error } = await supabase.storage
        .from('template-previews')
        .upload(filePath, previewFile, { upsert: true });

      setUploadProgress(80);

      if (error) {
        console.error('Upload error:', error);
        toast.error(getUserFriendlyError(error));
        return editingTemplate?.preview_url || null;
      }

      setUploadStage('جاري الحصول على الرابط...');
      setUploadProgress(90);
      const { data } = supabase.storage.from('template-previews').getPublicUrl(filePath);
      setUploadProgress(100);
      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('حدث خطأ أثناء رفع الصورة');
      return editingTemplate?.preview_url || null;
    }
  };

  const handleSave = async () => {
    if (!form.service_type) { toast.error('القسم مطلوب'); return; }
    setSaving(true);
    setUploadProgress(0);
    setUploadStage(previewFile ? 'بدء الرفع...' : 'جاري الحفظ...');

    try {
      if (editingTemplate) {
        const previewUrl = await uploadPreviewImage(editingTemplate.id);
        const { error } = await supabase
          .from('templates')
          .update({
            name: editingTemplate.id.slice(0, 8).toUpperCase(),
            description: form.description || null,
            service_type: form.service_type as any,
            preview_url: previewUrl,
            text_fields: textFields as any,
            specializations: form.specializations,
          } as any)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('تم تحديث القالب');
      } else {
        const { data: newTemplate, error } = await supabase
          .from('templates')
          .insert({
            name: 'template',
            description: form.description || null,
            service_type: form.service_type as any,
            text_fields: textFields as any,
            specializations: form.specializations,
          } as any)
          .select()
          .single();
        if (error) throw error;

        if (newTemplate) {
          // Update name to be the short ID after creation
          const shortId = newTemplate.id.slice(0, 8).toUpperCase();
          const previewUrl = previewFile ? await uploadPreviewImage(newTemplate.id) : null;
          await supabase.from('templates').update({ name: shortId, ...(previewUrl ? { preview_url: previewUrl } : {}) }).eq('id', newTemplate.id);
        }
        toast.success('تم إضافة القالب');
      }

      setDialogOpen(false);
      loadTemplates();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: Template) => {
    if (!confirm(`حذف القالب "${t.id.slice(0, 8).toUpperCase()}"؟`)) return;
    try {
      if (t.preview_url) {
        const path = t.preview_url.split('/template-previews/')[1];
        if (path) await supabase.storage.from('template-previews').remove([decodeURIComponent(path)]);
      }
      const { error } = await supabase.from('templates').delete().eq('id', t.id);
      if (error) throw error;
      toast.success('تم حذف القالب');
      loadTemplates();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const filtered = filterService === 'all' ? templates : templates.filter(t => t.service_type === filterService);
  const serviceCounts = Object.keys(serviceLabels).reduce((acc, key) => {
    acc[key] = templates.filter(t => t.service_type === key).length;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Select value={filterService} onValueChange={setFilterService}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="جميع الأقسام" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأقسام ({templates.length})</SelectItem>
              {Object.entries(serviceLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label as string} ({serviceCounts[key] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} قالب</span>
        </div>
        <Button onClick={openAdd} className="rounded-xl">
          <Plus className="w-4 h-4 ml-1" />
          إضافة قالب
        </Button>
      </div>

      {/* Templates Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Palette className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">لا توجد قوالب</p>
          <Button onClick={openAdd} variant="outline" className="mt-4 rounded-xl">
            <Plus className="w-4 h-4 ml-1" /> إضافة أول قالب
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="bg-card rounded-xl border border-border overflow-hidden shadow-sm group"
            >
              <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center relative overflow-hidden">
                {t.preview_url ? (
                  <img src={t.preview_url} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Image className="w-10 h-10 text-muted-foreground/30 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground/50">بدون صورة</p>
                  </div>
                )}
                {/* Field count badge */}
                {t.text_fields && t.text_fields.length > 0 && (
                  <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    <Type className="w-2.5 h-2.5" />
                    {t.text_fields.length}
                  </div>
                )}
                <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="sm" variant="secondary" className="rounded-lg" onClick={() => openEdit(t)}>
                    <Pencil className="w-3 h-3 ml-1" /> تعديل
                  </Button>
                  <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => handleDelete(t)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div className="p-3">
                <p className="font-mono font-bold text-primary text-xs tracking-widest">{t.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{serviceLabels[t.service_type] || t.service_type}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={`${showFieldEditor && previewLocalUrl ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`} dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'تعديل القالب' : 'إضافة قالب جديد'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Preview Image Upload */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">صورة القالب</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {previewLocalUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={previewLocalUrl} alt="preview" className="w-full aspect-[4/3] object-cover" />
                  <button
                    onClick={() => { setPreviewFile(null); setPreviewLocalUrl(null); setShowFieldEditor(false); }}
                    className="absolute top-2 left-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : uploading ? (
                <div className="border-2 border-dashed border-primary/40 rounded-xl p-8 text-center bg-primary/5">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">جاري تجهيز الصورة...</p>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">اضغط لرفع صورة</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG — حتى 20MB</p>
                </div>
              )}
            </div>




            {/* Service Type */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">القسم *</label>
              <Select value={form.service_type} onValueChange={v => setForm(f => ({ ...f, service_type: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {services.filter(s => s.parent_id).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Specializations (multi-select) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-foreground">التخصصات</label>
                {specializations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = form.specializations.length === specializations.length;
                      setForm(f => ({ ...f, specializations: allSelected ? [] : specializations.map(s => s.id) }));
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {form.specializations.length === specializations.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-border bg-background min-h-[44px]">
                {specializations.map(s => {
                  const selected = form.specializations.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        specializations: selected
                          ? f.specializations.filter(id => id !== s.id)
                          : [...f.specializations, s.id]
                      }))}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {s.icon} {s.label}
                    </button>
                  );
                })}
                {specializations.length === 0 && (
                  <span className="text-xs text-muted-foreground">لا توجد تخصصات</span>
                )}
              </div>
              {form.specializations.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{form.specializations.length} تخصص محدد</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">وصف</label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="وصف مختصر للقالب..."
                className="rounded-xl min-h-[80px]"
              />
            </div>

            {/* Upload Progress */}
            {saving && previewFile && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{uploadStage}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
                {saving ? (previewFile ? `جاري الرفع... ${uploadProgress}%` : 'جاري الحفظ...') : editingTemplate ? 'حفظ التغييرات' : 'إضافة القالب'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTemplates;
