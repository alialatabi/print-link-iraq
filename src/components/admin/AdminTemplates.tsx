import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Upload, Image, Palette, X } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  price: number | null;
}

interface TemplateFormData {
  name: string;
  description: string;
  service_type: string;
  price: string;
}

interface AdminTemplatesProps {
  // no props needed
}

const AdminTemplates = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterService, setFilterService] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState<TemplateFormData>({ name: '', description: '', service_type: 'business_card', price: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewLocalUrl, setPreviewLocalUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false });
    setTemplates((data as Template[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const openAdd = () => {
    setEditingTemplate(null);
    setForm({ name: '', description: '', service_type: 'business_card', price: '' });
    setPreviewFile(null);
    setPreviewLocalUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setForm({ name: t.name, description: t.description || '', service_type: t.service_type, price: t.price?.toString() || '' });
    setPreviewFile(null);
    setPreviewLocalUrl(t.preview_url);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن لا يتجاوز 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار ملف صورة فقط');
        return;
      }
      setPreviewFile(file);
      const url = URL.createObjectURL(file);
      setPreviewLocalUrl(url);
    } catch (error) {
      console.error('File selection error:', error);
      toast.error('حدث خطأ أثناء اختيار الصورة');
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadPreviewImage = async (templateId: string): Promise<string | null> => {
    if (!previewFile) return editingTemplate?.preview_url || null;

    try {
      const ext = previewFile.name.split('.').pop();
      const filePath = `${templateId}.${ext}`;

      // Delete old file if exists
      await supabase.storage.from('template-previews').remove([filePath]);

      const { error } = await supabase.storage
        .from('template-previews')
        .upload(filePath, previewFile, { upsert: true });

      if (error) {
        console.error('Upload error:', error);
        toast.error('فشل رفع الصورة: ' + error.message);
        return editingTemplate?.preview_url || null;
      }

      const { data } = supabase.storage.from('template-previews').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('حدث خطأ أثناء رفع الصورة');
      return editingTemplate?.preview_url || null;
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('اسم القالب مطلوب'); return; }
    setSaving(true);

    try {
      if (editingTemplate) {
        const previewUrl = await uploadPreviewImage(editingTemplate.id);
        const priceVal = form.price ? parseInt(form.price) : null;
        const { error } = await supabase
          .from('templates')
          .update({
            name: form.name,
            description: form.description || null,
            service_type: form.service_type as any,
            preview_url: previewUrl,
            price: priceVal,
          })
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('تم تحديث القالب');
      } else {
        const priceVal = form.price ? parseInt(form.price) : null;
        const { data: newTemplate, error } = await supabase
          .from('templates')
          .insert({
            name: form.name,
            description: form.description || null,
            service_type: form.service_type as any,
            price: priceVal,
          })
          .select()
          .single();
        if (error) throw error;

        // Upload image after getting the ID
        if (previewFile && newTemplate) {
          const previewUrl = await uploadPreviewImage(newTemplate.id);
          await supabase.from('templates').update({ preview_url: previewUrl }).eq('id', newTemplate.id);
        }
        toast.success('تم إضافة القالب');
      }

      setDialogOpen(false);
      loadTemplates();
    } catch (err: any) {
      toast.error('فشلت العملية: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: Template) => {
    if (!confirm(`حذف القالب "${t.name}"؟`)) return;
    try {
      // Delete preview image
      if (t.preview_url) {
        const path = t.preview_url.split('/template-previews/')[1];
        if (path) await supabase.storage.from('template-previews').remove([decodeURIComponent(path)]);
      }
      const { error } = await supabase.from('templates').delete().eq('id', t.id);
      if (error) throw error;
      toast.success('تم حذف القالب');
      loadTemplates();
    } catch (err: any) {
      toast.error('فشل الحذف: ' + err.message);
    }
  };

  const filtered = filterService === 'all' ? templates : templates.filter(t => t.service_type === filterService);

  const serviceCounts = Object.keys(SERVICE_LABELS).reduce((acc, key) => {
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
              {Object.entries(SERVICE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label} ({serviceCounts[key] || 0})
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
              {/* Preview Image */}
              <div className="aspect-[3/4] bg-muted/30 flex items-center justify-center relative overflow-hidden">
                {t.preview_url ? (
                  <img src={t.preview_url} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Image className="w-10 h-10 text-muted-foreground/30 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground/50">بدون صورة</p>
                  </div>
                )}
                {/* Overlay actions */}
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
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground text-sm truncate">{t.name}</h4>
                  {t.price != null && (
                    <span className="text-xs font-bold text-primary whitespace-nowrap">{t.price.toLocaleString('ar-IQ')} د.ع</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{SERVICE_LABELS[t.service_type as ServiceType]}</p>
                {t.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
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
                  <img src={previewLocalUrl} alt="preview" className="w-full aspect-[3/4] object-cover" />
                  <button
                    onClick={() => { setPreviewFile(null); setPreviewLocalUrl(null); }}
                    className="absolute top-2 left-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">اضغط لرفع صورة</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG — حتى 5MB</p>
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">اسم القالب *</label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: كارت بزنس كلاسيكي"
                className="rounded-xl"
              />
            </div>

            {/* Service Type */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">القسم *</label>
              <Select value={form.service_type} onValueChange={v => setForm(f => ({ ...f, service_type: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SERVICE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">السعر (د.ع)</label>
              <Input
                type="number"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="مثال: 15000"
                className="rounded-xl"
                min="0"
              />
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

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
                {saving ? 'جاري الحفظ...' : editingTemplate ? 'حفظ التغييرات' : 'إضافة القالب'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
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
