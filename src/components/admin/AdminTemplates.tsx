import { useEffect, useState, useCallback, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useServices, useSpecializations } from '@/hooks/useServices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Upload, Image, Palette, X, Type, CheckSquare, Tags, Images, Search } from 'lucide-react';
import TemplateFieldEditor, { type TextField } from './TemplateFieldEditor';
import { getUserFriendlyError } from '@/lib/errors';

interface Template {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  preview_urls: string[];
  text_fields: TextField[];
  specializations: string[];
}

interface TemplateFormData {
  service_type: string;
  specializations: string[];
}

const AdminTemplates = () => {
  const { services } = useServices();
  const { specializations } = useSpecializations();
  const serviceLabels = Object.fromEntries(services.map(s => [s.id, s.label]));
  const specMap = Object.fromEntries(specializations.map(s => [s.id, s]));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterService, setFilterService] = useState<string>('all');
  const [filterSpec, setFilterSpec] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState<TemplateFormData>({ service_type: 'business_card', specializations: [] });
  const [textFields, setTextFields] = useState<TextField[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [previewLocalUrls, setPreviewLocalUrls] = useState<string[]>([]);
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Template[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [specDialogOpen, setSpecDialogOpen] = useState(false);
  const [bulkSpecMode, setBulkSpecMode] = useState<'replace' | 'add' | 'remove'>('replace');
  const [bulkSpecs, setBulkSpecs] = useState<string[]>([]);
  const [applyingSpecs, setApplyingSpecs] = useState(false);
  // Bulk upload: one image → one template
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkServiceType, setBulkServiceType] = useState('business_card');
  const [bulkUploadSpecs, setBulkUploadSpecs] = useState<string[]>([]);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkPreviews, setBulkPreviews] = useState<string[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkPreparing, setBulkPreparing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkDone, setBulkDone] = useState(0);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

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
    setForm({ service_type: 'business_card', specializations: [] });
    setTextFields([]);
    setPreviewFiles([]);
    setPreviewLocalUrls([]);
    setExistingUrls([]);
    setDialogOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditingTemplate(t);
    setForm({ service_type: t.service_type, specializations: t.specializations || [] });
    setTextFields(t.text_fields || []);
    setPreviewFiles([]);
    const urls = t.preview_urls?.length ? t.preview_urls : (t.preview_url ? [t.preview_url] : []);
    setPreviewLocalUrls(urls);
    setExistingUrls(urls);
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
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error('حجم الصورة يجب أن لا يتجاوز 20MB');
          return;
        }
        if (!file.type.startsWith('image/')) {
          toast.error('يرجى اختيار ملف صورة فقط');
          return;
        }
      }
      setUploading(true);
      const newLocalUrls: string[] = [];
      for (const file of files) {
        const compressedUrl = await compressImageForPreview(file);
        newLocalUrls.push(compressedUrl);
      }
      setPreviewFiles(prev => [...prev, ...files]);
      setPreviewLocalUrls(prev => [...prev, ...newLocalUrls]);
    } catch (error) {
      console.error('File selection error:', error);
      toast.error('حدث خطأ أثناء اختيار الصورة');
    } finally {
      setUploading(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadPreviewImages = async (templateId: string): Promise<string[]> => {
    // Start with existing URLs that weren't removed
    const uploadedUrls: string[] = [...existingUrls.filter(u => previewLocalUrls.includes(u))];
    
    if (!previewFiles.length) return uploadedUrls;

    try {
      setUploadStage('جاري رفع الصور...');
      const totalFiles = previewFiles.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = previewFiles[i];
        const ext = file.name.split('.').pop();
        const filePath = `${templateId}_${Date.now()}_${i}.${ext}`;
        
        setUploadProgress(Math.round(((i + 0.5) / totalFiles) * 90));
        
        const { error } = await supabase.storage
          .from('template-previews')
          .upload(filePath, file, { upsert: true });
        
        if (error) {
          console.error('Upload error:', error);
          toast.error(getUserFriendlyError(error));
          continue;
        }
        
        const { data } = supabase.storage.from('template-previews').getPublicUrl(filePath);
        uploadedUrls.push(data.publicUrl);
      }
      
      setUploadProgress(100);
      return uploadedUrls;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('حدث خطأ أثناء رفع الصور');
      return uploadedUrls;
    }
  };

  const handleSave = async () => {
    if (!form.service_type) { toast.error('القسم مطلوب'); return; }
    setSaving(true);
    setUploadProgress(0);
    setUploadStage(previewFiles.length ? 'بدء الرفع...' : 'جاري الحفظ...');

    try {
      if (editingTemplate) {
        const urls = await uploadPreviewImages(editingTemplate.id);
        const { error } = await supabase
          .from('templates')
          .update({
            name: editingTemplate.id.slice(0, 8).toUpperCase(),
            service_type: form.service_type as any,
            preview_url: urls[0] || null,
            preview_urls: urls,
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
            service_type: form.service_type as any,
            text_fields: textFields as any,
            specializations: form.specializations,
          } as any)
          .select()
          .single();
        if (error) throw error;

        if (newTemplate) {
          const shortId = newTemplate.id.slice(0, 8).toUpperCase();
          const urls = previewFiles.length ? await uploadPreviewImages(newTemplate.id) : [];
          await supabase.from('templates').update({ 
            name: shortId, 
            preview_url: urls[0] || null,
            preview_urls: urls,
          } as any).eq('id', newTemplate.id);
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

  const query = search.trim().toLowerCase();
  const filtered = templates.filter(t => {
    if (filterService !== 'all' && t.service_type !== filterService) return false;
    const specs = t.specializations || [];
    if (filterSpec === 'none') {
      if (specs.length > 0) return false;
    } else if (filterSpec !== 'all') {
      if (!specs.includes(filterSpec)) return false;
    }
    if (query) {
      const specLabels = specs.map(id => specMap[id]?.label || '').join(' ');
      const haystack = `${t.id} ${serviceLabels[t.service_type] || t.service_type} ${specLabels}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const serviceCounts = Object.keys(serviceLabels).reduce((acc, key) => {
    acc[key] = templates.filter(t => t.service_type === key).length;
    return acc;
  }, {} as Record<string, number>);
  const specCounts = specializations.reduce((acc, s) => {
    acc[s.id] = templates.filter(t => (t.specializations || []).includes(s.id)).length;
    return acc;
  }, {} as Record<string, number>);
  const noSpecCount = templates.filter(t => !(t.specializations || []).length).length;

  const hasActiveFilters = filterService !== 'all' || filterSpec !== 'all' || query !== '';
  const clearFilters = () => { setFilterService('all'); setFilterSpec('all'); setSearch(''); };

  const toggleSelectionMode = () => {
    setSelectionMode(prev => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(t => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      if (filtered.every(t => prev.has(t.id))) {
        // Deselect all currently filtered
        const next = new Set(prev);
        filtered.forEach(t => next.delete(t.id));
        return next;
      }
      // Select all currently filtered
      const next = new Set(prev);
      filtered.forEach(t => next.add(t.id));
      return next;
    });
  };

  const requestDeleteSelected = () => {
    const targets = templates.filter(t => selectedIds.has(t.id));
    if (targets.length === 0) return;
    setDeleteTarget(targets);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteTarget.length === 0) return;
    setDeleting(true);
    try {
      // Collect all storage paths from preview images across the targeted templates
      const paths = deleteTarget
        .flatMap(t => (t.preview_urls?.length ? t.preview_urls : (t.preview_url ? [t.preview_url] : [])))
        .map(url => url.split('/template-previews/')[1])
        .filter(Boolean)
        .map(p => decodeURIComponent(p as string));
      if (paths.length) {
        await supabase.storage.from('template-previews').remove(paths);
      }

      const ids = deleteTarget.map(t => t.id);
      const { error } = await supabase.from('templates').delete().in('id', ids);
      if (error) throw error;

      toast.success(ids.length > 1 ? `تم حذف ${ids.length} قالب` : 'تم حذف القالب');
      setSelectedIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      setDeleteTarget(null);
      loadTemplates();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setDeleting(false);
    }
  };

  const openSpecDialog = () => {
    if (selectedIds.size === 0) return;
    setBulkSpecMode('replace');
    setBulkSpecs([]);
    setSpecDialogOpen(true);
  };

  const toggleBulkSpec = (id: string) => {
    setBulkSpecs(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const applyBulkSpecs = async () => {
    const targets = templates.filter(t => selectedIds.has(t.id));
    if (targets.length === 0) return;
    if (bulkSpecMode !== 'replace' && bulkSpecs.length === 0) {
      toast.error('اختر تخصصاً واحداً على الأقل');
      return;
    }
    setApplyingSpecs(true);
    try {
      if (bulkSpecMode === 'replace') {
        // Same array for everyone → a single query.
        const { error } = await supabase
          .from('templates')
          .update({ specializations: bulkSpecs } as any)
          .in('id', targets.map(t => t.id));
        if (error) throw error;
      } else {
        // Add/remove differ per template → compute each then update.
        const results = await Promise.all(targets.map(t => {
          const current = t.specializations || [];
          const next = bulkSpecMode === 'add'
            ? Array.from(new Set([...current, ...bulkSpecs]))
            : current.filter(s => !bulkSpecs.includes(s));
          return supabase.from('templates').update({ specializations: next } as any).eq('id', t.id);
        }));
        const failed = results.find(r => r.error);
        if (failed?.error) throw failed.error;
      }
      toast.success(`تم تحديث تخصصات ${targets.length} قالب`);
      setSpecDialogOpen(false);
      loadTemplates();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setApplyingSpecs(false);
    }
  };

  // ─── Bulk upload (one image → one template) ───────────────────────────────
  const openBulkUpload = () => {
    const firstSub = services.find(s => s.parent_id)?.id || 'business_card';
    setBulkServiceType(firstSub);
    setBulkUploadSpecs([]);
    setBulkFiles([]);
    setBulkPreviews([]);
    setBulkProgress(0);
    setBulkDone(0);
    setBulkUploadOpen(true);
  };

  const handleBulkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      if (!file.type.startsWith('image/')) { toast.error('يرجى اختيار ملفات صور فقط'); return; }
      if (file.size > 20 * 1024 * 1024) { toast.error('حجم كل صورة يجب أن لا يتجاوز 20MB'); return; }
    }
    setBulkPreparing(true);
    try {
      const thumbs: string[] = [];
      for (const file of files) thumbs.push(await compressImageForPreview(file));
      setBulkFiles(prev => [...prev, ...files]);
      setBulkPreviews(prev => [...prev, ...thumbs]);
    } catch (err) {
      console.error('Bulk preview error:', err);
      toast.error('حدث خطأ أثناء تجهيز الصور');
    } finally {
      setBulkPreparing(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    }
  };

  const removeBulkFile = (idx: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== idx));
    setBulkPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBulkUpload = async () => {
    if (!bulkServiceType) { toast.error('القسم مطلوب'); return; }
    if (bulkFiles.length === 0) { toast.error('اختر صورة واحدة على الأقل'); return; }
    setBulkUploading(true);
    setBulkProgress(0);
    setBulkDone(0);
    let failures = 0;
    try {
      for (let i = 0; i < bulkFiles.length; i++) {
        const file = bulkFiles[i];
        try {
          const { data: newTemplate, error } = await supabase
            .from('templates')
            .insert({
              name: 'template',
              service_type: bulkServiceType as any,
              text_fields: [] as any,
              specializations: bulkUploadSpecs,
            } as any)
            .select()
            .single();
          if (error || !newTemplate) throw error || new Error('insert failed');

          const ext = file.name.split('.').pop();
          const filePath = `${newTemplate.id}_${Date.now()}_0.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('template-previews')
            .upload(filePath, file, { upsert: true });
          if (upErr) throw upErr;

          const { data: pub } = supabase.storage.from('template-previews').getPublicUrl(filePath);
          await supabase.from('templates').update({
            name: newTemplate.id.slice(0, 8).toUpperCase(),
            preview_url: pub.publicUrl,
            preview_urls: [pub.publicUrl],
          } as any).eq('id', newTemplate.id);

          setBulkDone(d => d + 1);
        } catch (err) {
          console.error('Bulk upload item failed:', err);
          failures++;
        }
        setBulkProgress(Math.round(((i + 1) / bulkFiles.length) * 100));
      }

      const created = bulkFiles.length - failures;
      if (created > 0) toast.success(`تم إنشاء ${created} قالب`);
      if (failures > 0) toast.error(`فشل رفع ${failures} صورة`);
      setBulkUploadOpen(false);
      loadTemplates();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setBulkUploading(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالرقم أو القسم أو التخصص..."
              className="w-56 pr-9 rounded-xl"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Service filter */}
          <Select value={filterService} onValueChange={setFilterService}>
            <SelectTrigger className="w-44 rounded-xl">
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
          {/* Specialization filter */}
          <Select value={filterSpec} onValueChange={setFilterSpec}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue placeholder="جميع التخصصات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع التخصصات</SelectItem>
              <SelectItem value="none">بدون تخصص ({noSpecCount})</SelectItem>
              {specializations.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.icon} {s.label} ({specCounts[s.id] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-xl text-muted-foreground">
              <X className="w-4 h-4 ml-1" />
              مسح
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{filtered.length} قالب</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectionMode ? (
            <>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <Checkbox checked={allFilteredSelected} className="pointer-events-none" />
                {allFilteredSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
              <Button
                variant="outline"
                onClick={openSpecDialog}
                disabled={selectedIds.size === 0}
                className="rounded-xl"
              >
                <Tags className="w-4 h-4 ml-1" />
                تغيير التخصص ({selectedIds.size})
              </Button>
              <Button
                variant="destructive"
                onClick={requestDeleteSelected}
                disabled={selectedIds.size === 0}
                className="rounded-xl"
              >
                <Trash2 className="w-4 h-4 ml-1" />
                حذف المحدد ({selectedIds.size})
              </Button>
              <Button variant="outline" onClick={toggleSelectionMode} className="rounded-xl">
                إلغاء
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={toggleSelectionMode} className="rounded-xl" disabled={templates.length === 0}>
                <CheckSquare className="w-4 h-4 ml-1" />
                تحديد
              </Button>
              <Button variant="outline" onClick={openBulkUpload} className="rounded-xl">
                <Images className="w-4 h-4 ml-1" />
                رفع بالجملة
              </Button>
              <Button onClick={openAdd} className="rounded-xl">
                <Plus className="w-4 h-4 ml-1" />
                إضافة قالب
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Templates Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          {hasActiveFilters ? (
            <>
              <Search className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">لا توجد نتائج مطابقة</p>
              <Button onClick={clearFilters} variant="outline" className="mt-4 rounded-xl">
                <X className="w-4 h-4 ml-1" /> مسح الفلاتر
              </Button>
            </>
          ) : (
            <>
              <Palette className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">لا توجد قوالب</p>
              <Button onClick={openAdd} variant="outline" className="mt-4 rounded-xl">
                <Plus className="w-4 h-4 ml-1" /> إضافة أول قالب
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className={`bg-card rounded-xl border overflow-hidden shadow-sm group transition-colors ${
                selectionMode && selectedIds.has(t.id) ? 'border-primary ring-2 ring-primary' : 'border-border'
              }`}
            >
              <div
                className={`aspect-square bg-muted/30 flex items-center justify-center relative overflow-hidden ${selectionMode ? 'cursor-pointer' : ''}`}
                onClick={selectionMode ? () => toggleSelect(t.id) : undefined}
              >
                {t.preview_url ? (
                  <img src={t.preview_url} alt={t.name} loading="lazy" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="text-center">
                    <Image className="w-10 h-10 text-muted-foreground/30 mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground/50">بدون صورة</p>
                  </div>
                )}
                {/* Selection checkbox */}
                {selectionMode && (
                  <div className="absolute top-2 left-2 bg-card/90 rounded-md p-1 shadow-sm">
                    <Checkbox checked={selectedIds.has(t.id)} className="pointer-events-none" />
                  </div>
                )}
                {/* Field count badge */}
                {t.text_fields && t.text_fields.length > 0 && (
                  <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    <Type className="w-2.5 h-2.5" />
                    {t.text_fields.length}
                  </div>
                )}
                {!selectionMode && (
                  <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" className="rounded-lg" onClick={() => openEdit(t)}>
                      <Pencil className="w-3 h-3 ml-1" /> تعديل
                    </Button>
                    <Button size="sm" variant="destructive" className="rounded-lg" onClick={() => setDeleteTarget([t])}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-mono font-bold text-primary text-xs tracking-widest">{t.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{serviceLabels[t.service_type] || t.service_type}</p>
                {/* Specializations */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {t.specializations && t.specializations.length > 0 ? (
                    t.specializations.map(specId => {
                      const spec = specMap[specId];
                      return (
                        <span
                          key={specId}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium"
                        >
                          {spec?.icon} {spec?.label || specId}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60">بدون تخصص</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'تعديل القالب' : 'إضافة قالب جديد'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Preview Images Upload */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">صور القالب</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              {previewLocalUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {previewLocalUrls.map((url, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden border border-border aspect-square">
                      <img src={url} alt="preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => {
                          setPreviewLocalUrls(prev => prev.filter((_, i) => i !== idx));
                          // If it's a new file (not existing), remove from previewFiles too
                          const existingCount = existingUrls.filter(u => previewLocalUrls.includes(u)).length;
                          if (idx >= existingCount) {
                            setPreviewFiles(prev => prev.filter((_, i) => i !== (idx - existingCount)));
                          } else {
                            setExistingUrls(prev => prev.filter((_, i) => i !== idx));
                          }
                        }}
                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {uploading ? (
                <div className="border-2 border-dashed border-primary/40 rounded-xl p-6 text-center bg-primary/5">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">جاري تجهيز الصور...</p>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">اضغط لرفع صور (يمكنك اختيار أكثر من صورة)</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG — حتى 20MB لكل صورة</p>
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

            {/* Description (inherited from the sub-service, shared by all its templates) */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">وصف القسم</label>
              {(() => {
                const svcDescription = services.find(s => s.id === form.service_type)?.description?.trim();
                return svcDescription ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded-xl p-3 border border-border/40">
                    {svcDescription}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3 border border-border/40">
                    لا يوجد وصف لهذا القسم بعد.
                  </p>
                );
              })()}
              <p className="text-[11px] text-muted-foreground mt-1">
                الوصف تابع للقسم (الخدمة الفرعية) ويظهر في جميع قوالبه. عدّله من قسم «الخدمات».
              </p>
            </div>

            {/* Upload Progress */}
            {saving && previewFiles.length > 0 && (
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
                {saving ? (previewFiles.length ? `جاري الرفع... ${uploadProgress}%` : 'جاري الحفظ...') : editingTemplate ? 'حفظ التغييرات' : 'إضافة القالب'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.length > 1
                ? `هل أنت متأكد من حذف ${deleteTarget.length} قالب؟ لا يمكن التراجع عن هذا الإجراء.`
                : `هل أنت متأكد من حذف القالب "${deleteTarget?.[0]?.id.slice(0, 8).toUpperCase() ?? ''}"؟ لا يمكن التراجع عن هذا الإجراء.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleting} className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Change Specializations Dialog */}
      <Dialog open={specDialogOpen} onOpenChange={(open) => { if (!applyingSpecs) setSpecDialogOpen(open); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير تخصصات {selectedIds.size} قالب</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Mode selector */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">طريقة التغيير</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'replace', label: 'استبدال' },
                  { key: 'add', label: 'إضافة' },
                  { key: 'remove', label: 'إزالة' },
                ] as const).map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setBulkSpecMode(m.key)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                      bulkSpecMode === m.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {bulkSpecMode === 'replace' && 'يستبدل تخصصات كل القوالب المحددة بالمختار (اترك الكل فارغاً لمسح التخصصات).'}
                {bulkSpecMode === 'add' && 'يضيف التخصصات المختارة دون حذف الحالية.'}
                {bulkSpecMode === 'remove' && 'يزيل التخصصات المختارة من القوالب المحددة.'}
              </p>
            </div>

            {/* Specializations multi-select */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-foreground">التخصصات</label>
                {specializations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = bulkSpecs.length === specializations.length;
                      setBulkSpecs(allSelected ? [] : specializations.map(s => s.id));
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {bulkSpecs.length === specializations.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-border bg-background min-h-[44px]">
                {specializations.map(s => {
                  const selected = bulkSpecs.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleBulkSpec(s.id)}
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
              {bulkSpecs.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{bulkSpecs.length} تخصص محدد</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={applyBulkSpecs} disabled={applyingSpecs} className="flex-1 rounded-xl">
                {applyingSpecs ? 'جاري التطبيق...' : 'تطبيق'}
              </Button>
              <Button variant="outline" onClick={() => setSpecDialogOpen(false)} disabled={applyingSpecs} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog (one image → one template) */}
      <Dialog open={bulkUploadOpen} onOpenChange={(open) => { if (!bulkUploading) setBulkUploadOpen(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>رفع قوالب بالجملة</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground">
              كل صورة تُنشئ قالباً مستقلاً ضمن القسم والتخصصات المختارة.
            </p>

            {/* Service Type */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">القسم *</label>
              <Select value={bulkServiceType} onValueChange={setBulkServiceType}>
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

            {/* Specializations */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-foreground">التخصصات</label>
                {specializations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = bulkUploadSpecs.length === specializations.length;
                      setBulkUploadSpecs(allSelected ? [] : specializations.map(s => s.id));
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {bulkUploadSpecs.length === specializations.length ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-border bg-background min-h-[44px]">
                {specializations.map(s => {
                  const selected = bulkUploadSpecs.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setBulkUploadSpecs(prev => selected ? prev.filter(id => id !== s.id) : [...prev, s.id])}
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
            </div>

            {/* Images */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">الصور</label>
              <input
                ref={bulkFileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleBulkFileChange}
                className="hidden"
              />
              {bulkPreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {bulkPreviews.map((url, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-border aspect-square">
                      <img src={url} alt="preview" className="w-full h-full object-cover" />
                      {!bulkUploading && (
                        <button
                          onClick={() => removeBulkFile(idx)}
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {bulkPreparing ? (
                <div className="border-2 border-dashed border-primary/40 rounded-xl p-6 text-center bg-primary/5">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">جاري تجهيز الصور...</p>
                </div>
              ) : (
                <div
                  onClick={() => bulkFileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">اضغط لاختيار عدة صور</p>
                  <p className="text-xs text-muted-foreground mt-1">كل صورة = قالب — PNG, JPG حتى 20MB</p>
                </div>
              )}
              {bulkFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{bulkFiles.length} صورة محددة</p>
              )}
            </div>

            {/* Upload Progress */}
            {bulkUploading && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>جاري إنشاء القوالب... ({bulkDone}/{bulkFiles.length})</span>
                  <span>{bulkProgress}%</span>
                </div>
                <Progress value={bulkProgress} className="h-2" />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleBulkUpload} disabled={bulkUploading || bulkPreparing || bulkFiles.length === 0} className="flex-1 rounded-xl">
                {bulkUploading ? `جاري الرفع... ${bulkProgress}%` : `إنشاء ${bulkFiles.length || ''} قالب`}
              </Button>
              <Button variant="outline" onClick={() => setBulkUploadOpen(false)} disabled={bulkUploading} className="rounded-xl">
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
