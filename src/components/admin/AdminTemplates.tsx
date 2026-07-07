import { useEffect, useState, useCallback, useRef } from 'react';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useServices, useSpecializations } from '@/hooks/useServices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Plus, Pencil, Trash2, Image, Palette, X, Type, CheckSquare, Tags, Images, Search } from 'lucide-react';
import { type TextField } from './TemplateFieldEditor';
import { getUserFriendlyError } from '@/lib/errors';
import { TemplateEditDialog } from './TemplateEditDialog';
import { BulkSpecsDialog } from './BulkSpecsDialog';
import { BulkUploadDialog } from './BulkUploadDialog';

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
            service_type: form.service_type,
            preview_url: urls[0] || null,
            preview_urls: urls,
            text_fields: textFields,
            specializations: form.specializations,
          } as never)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('تم تحديث القالب');
      } else {
        const { data: newTemplate, error } = await supabase
          .from('templates')
          .insert({
            name: 'template',
            service_type: form.service_type,
            text_fields: textFields,
            specializations: form.specializations,
          } as never)
          .select()
          .single();
        if (error) throw error;

        if (newTemplate) {
          const shortId = (newTemplate as { id: string }).id.slice(0, 8).toUpperCase();
          const urls = previewFiles.length ? await uploadPreviewImages((newTemplate as { id: string }).id) : [];
          await supabase.from('templates').update({
            name: shortId,
            preview_url: urls[0] || null,
            preview_urls: urls,
          } as never).eq('id', (newTemplate as { id: string }).id);
        }
        toast.success('تم إضافة القالب');
      }

      setDialogOpen(false);
      loadTemplates();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
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
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
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
          .update({ specializations: bulkSpecs })
          .in('id', targets.map(t => t.id));
        if (error) throw error;
      } else {
        // Add/remove differ per template → compute each then update.
        const results = await Promise.all(targets.map(t => {
          const current = t.specializations || [];
          const next = bulkSpecMode === 'add'
            ? Array.from(new Set([...current, ...bulkSpecs]))
            : current.filter(s => !bulkSpecs.includes(s));
          return supabase.from('templates').update({ specializations: next }).eq('id', t.id);
        }));
        const failed = results.find(r => r.error);
        if (failed?.error) throw failed.error;
      }
      toast.success(`تم تحديث تخصصات ${targets.length} قالب`);
      setSpecDialogOpen(false);
      loadTemplates();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
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
              service_type: bulkServiceType,
              text_fields: [],
              specializations: bulkUploadSpecs,
            } as never)
            .select()
            .single();
          if (error || !newTemplate) throw error || new Error('insert failed');

          const tmplId = (newTemplate as { id: string }).id;
          const ext = file.name.split('.').pop();
          const filePath = `${tmplId}_${Date.now()}_0.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('template-previews')
            .upload(filePath, file, { upsert: true });
          if (upErr) throw upErr;

          const { data: pub } = supabase.storage.from('template-previews').getPublicUrl(filePath);
          await supabase.from('templates').update({
            name: tmplId.slice(0, 8).toUpperCase(),
            preview_url: pub.publicUrl,
            preview_urls: [pub.publicUrl],
          } as never).eq('id', tmplId);

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
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
    } finally {
      setBulkUploading(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالرقم أو القسم أو التخصص..."
              className="w-full pr-9 rounded-xl"
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
            <SelectTrigger className="w-full sm:w-44 rounded-xl">
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
            <SelectTrigger className="w-full sm:w-44 rounded-xl">
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
            <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-xl text-muted-foreground w-full sm:w-auto">
              <X className="w-4 h-4 ml-1" />
              مسح
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{filtered.length} قالب</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {selectionMode ? (
            <>
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
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
                  <div className="absolute inset-0 bg-foreground/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
      <TemplateEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingTemplate={editingTemplate}
        form={form}
        setForm={setForm}
        previewLocalUrls={previewLocalUrls}
        setPreviewLocalUrls={setPreviewLocalUrls}
        previewFiles={previewFiles}
        setPreviewFiles={setPreviewFiles}
        existingUrls={existingUrls}
        setExistingUrls={setExistingUrls}
        uploading={uploading}
        saving={saving}
        uploadProgress={uploadProgress}
        uploadStage={uploadStage}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        handleSave={handleSave}
        services={services}
        specializations={specializations}
      />

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
      <BulkSpecsDialog
        open={specDialogOpen}
        onOpenChange={(open) => { if (!applyingSpecs) setSpecDialogOpen(open); }}
        selectedCount={selectedIds.size}
        applyingSpecs={applyingSpecs}
        specializations={specializations}
        bulkSpecMode={bulkSpecMode}
        setBulkSpecMode={setBulkSpecMode}
        bulkSpecs={bulkSpecs}
        toggleBulkSpec={toggleBulkSpec}
        setBulkSpecs={setBulkSpecs}
        applyBulkSpecs={applyBulkSpecs}
      />

      {/* Bulk Upload Dialog (one image → one template) */}
      <BulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={(open) => { if (!bulkUploading) setBulkUploadOpen(open); }}
        services={services}
        specializations={specializations}
        bulkServiceType={bulkServiceType}
        setBulkServiceType={setBulkServiceType}
        bulkUploadSpecs={bulkUploadSpecs}
        setBulkUploadSpecs={setBulkUploadSpecs}
        bulkFiles={bulkFiles}
        bulkPreviews={bulkPreviews}
        bulkUploading={bulkUploading}
        bulkPreparing={bulkPreparing}
        bulkProgress={bulkProgress}
        bulkDone={bulkDone}
        bulkFileInputRef={bulkFileInputRef}
        handleBulkFileChange={handleBulkFileChange}
        removeBulkFile={removeBulkFile}
        handleBulkUpload={handleBulkUpload}
      />
    </div>
  );
};

export default AdminTemplates;
