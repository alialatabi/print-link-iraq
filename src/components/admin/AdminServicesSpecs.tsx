import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Briefcase, Layers } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/errors';
import { type AiFieldsRow, emptyAiFields, aiFieldsFromRow, aiFieldsToRow, aiFieldsValid } from '@/components/admin/AiFieldsEditor';
import type { Service, Specialization, ServiceFormState } from '@/components/admin/adminTypes';
import ServicesTabContent from '@/components/admin/ServicesTabContent';
import SpecializationsTabContent from '@/components/admin/SpecializationsTabContent';
import ServiceEditDialog from '@/components/admin/ServiceEditDialog';

const emptyForm = (): ServiceFormState => ({
  id: '', label: '', icon: '', description: '', price: 0, cost: 0,
  parent_id: '', completion_days: 0, min_quantity: 1, cellophane_type: 'none',
  print_enabled: true, ai_enabled: false, ai_fee: 0, aiFields: emptyAiFields(),
});

const AdminServicesSpecs = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'service' | 'specialization'>('service');
  const [editing, setEditing] = useState<Service | Specialization | null>(null);
  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [existingIconUrl, setExistingIconUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGroup, setDragGroup] = useState<string | null>(null);

  const handleDragStart = (id: string, group: string) => {
    setDragId(id);
    setDragGroup(group);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetId: string, group: string) => {
    if (!dragId || dragId === targetId || dragGroup !== group) {
      setDragId(null);
      setDragGroup(null);
      return;
    }

    let items: Service[];
    if (group === 'parents') {
      items = [...services.filter(s => !s.parent_id)].sort((a, b) => a.sort_order - b.sort_order);
    } else {
      items = [...services.filter(s => s.parent_id === group)].sort((a, b) => a.sort_order - b.sort_order);
    }

    const dragIndex = items.findIndex(s => s.id === dragId);
    const targetIndex = items.findIndex(s => s.id === targetId);
    if (dragIndex === -1 || targetIndex === -1) return;

    const [moved] = items.splice(dragIndex, 1);
    items.splice(targetIndex, 0, moved);

    const updates = items.map((item, idx) => ({ id: item.id, sort_order: idx + 1 }));
    setServices(prev => prev.map(s => {
      const update = updates.find(u => u.id === s.id);
      return update ? { ...s, sort_order: update.sort_order } : s;
    }));
    setDragId(null);
    setDragGroup(null);

    try {
      await Promise.all(updates.map(u =>
        supabase.from('services').update({ sort_order: u.sort_order }).eq('id', u.id),
      ));
      toast.success('تم تحديث الترتيب');
    } catch (_err: unknown) {
      toast.error('فشل حفظ الترتيب');
      loadData();
    }
  };

  const handleSpecDragStart = (id: string) => {
    setDragId(id);
    setDragGroup('specs');
  };

  const handleSpecDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId || dragGroup !== 'specs') {
      setDragId(null);
      setDragGroup(null);
      return;
    }

    const items = [...specializations].sort((a, b) => a.sort_order - b.sort_order);
    const dragIndex = items.findIndex(s => s.id === dragId);
    const targetIndex = items.findIndex(s => s.id === targetId);
    if (dragIndex === -1 || targetIndex === -1) return;

    const [moved] = items.splice(dragIndex, 1);
    items.splice(targetIndex, 0, moved);

    const updates = items.map((item, idx) => ({ id: item.id, sort_order: idx + 1 }));
    setSpecializations(prev => prev.map(s => {
      const update = updates.find(u => u.id === s.id);
      return update ? { ...s, sort_order: update.sort_order } : s;
    }));
    setDragId(null);
    setDragGroup(null);

    try {
      await Promise.all(updates.map(u =>
        supabase.from('specializations').update({ sort_order: u.sort_order }).eq('id', u.id),
      ));
      toast.success('تم تحديث الترتيب');
    } catch {
      toast.error('فشل حفظ الترتيب');
      loadData();
    }
  };

  const loadData = useCallback(async () => {
    const [{ data: svcData }, { data: specsData }] = await Promise.all([
      supabase.from('services').select('*').order('sort_order'),
      supabase.from('specializations').select('*').order('sort_order'),
    ]);
    setServices((svcData as Service[]) || []);
    setSpecializations((specsData as Specialization[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = (type: 'service' | 'specialization') => {
    setDialogType(type);
    setEditing(null);
    setForm(emptyForm());
    setIconFile(null);
    setIconPreview(null);
    setExistingIconUrl(null);
    setDialogOpen(true);
  };

  const openEdit = (item: Service | Specialization, type: 'service' | 'specialization') => {
    setDialogType(type);
    setEditing(item);
    setForm({
      id: item.id,
      label: item.label,
      icon: item.icon,
      description: 'description' in item ? (item as Service).description : '',
      price: 'price' in item ? (item as Service).price : 0,
      cost: 'cost' in item ? (item as Service).cost : 0,
      parent_id: 'parent_id' in item ? ((item as Service).parent_id || '') : '',
      completion_days: 'completion_days' in item ? (item as Service).completion_days : 0,
      min_quantity: 'min_quantity' in item ? ((item as Service).min_quantity || 1) : 1,
      cellophane_type: 'cellophane_type' in item ? ((item as Service).cellophane_type || 'none') : 'none',
      print_enabled: 'price' in item ? ((item as Service).print_enabled ?? true) : true,
      ai_enabled: 'price' in item ? ((item as Service).ai_enabled ?? false) : false,
      ai_fee: 'price' in item ? ((item as Service).ai_fee ?? 0) : 0,
      aiFields: aiFieldsFromRow('price' in item ? (item as Service as unknown as Partial<AiFieldsRow>) : null),
    });
    setIconFile(null);
    setIconPreview(null);
    setExistingIconUrl(item.icon_url || null);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('يرجى اختيار صورة فقط'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('حجم الصورة يجب أن لا يتجاوز 5MB'); return; }
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
    setExistingIconUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeIcon = () => {
    setIconFile(null);
    setIconPreview(null);
    setExistingIconUrl(null);
  };

  const uploadIcon = async (itemId: string): Promise<string | null> => {
    if (!iconFile) return existingIconUrl;
    const ext = iconFile.name.split('.').pop();
    const safeName = itemId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `${dialogType}/${safeName}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('service-icons').upload(path, iconFile, { upsert: true });
    if (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع الصورة: ' + error.message);
      return existingIconUrl;
    }
    const { data } = supabase.storage.from('service-icons').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.label.trim()) { toast.error('الاسم مطلوب'); return; }
    if (dialogType === 'service' && !editing && !iconFile) { toast.error('صورة الأيقونة مطلوبة'); return; }
    if (dialogType === 'specialization' && !form.icon.trim() && !iconFile && !existingIconUrl) { toast.error('الأيقونة أو الصورة مطلوبة'); return; }
    if (dialogType === 'service' && form.parent_id && form.ai_enabled && !aiFieldsValid(form.aiFields)) {
      toast.error('أضف قياساً واحداً على الأقل لخيارات التصميم بالذكاء الاصطناعي'); return;
    }
    setSaving(true);
    try {
      if (dialogType === 'service') {
        const channelCols = { print_enabled: form.print_enabled, ai_enabled: form.ai_enabled, ai_fee: form.ai_fee, ...aiFieldsToRow(form.aiFields) };
        if (editing) {
          const iconUrl = await uploadIcon(editing.id);
          const { error } = await supabase
            .from('services')
            .update({ label: form.label, icon: form.icon || '📄', description: form.description, icon_url: iconUrl, price: form.price, cost: form.cost, parent_id: form.parent_id || null, completion_days: form.completion_days, min_quantity: form.min_quantity, cellophane_type: form.cellophane_type, ...channelCols } as never)
            .eq('id', editing.id);
          if (error) throw error;
          toast.success('تم تحديث الخدمة');
        } else {
          const id = crypto.randomUUID();
          const maxOrder = services.length > 0 ? Math.max(...services.map(s => s.sort_order)) : 0;
          const iconUrl = await uploadIcon(id);
          const { error } = await supabase
            .from('services')
            .insert({ id, label: form.label, icon: form.icon || '📄', description: form.description, sort_order: maxOrder + 1, icon_url: iconUrl, price: form.price, cost: form.cost, parent_id: form.parent_id || null, completion_days: form.completion_days, min_quantity: form.min_quantity, cellophane_type: form.cellophane_type, ...channelCols } as never);
          if (error) throw error;
          toast.success('تمت إضافة الخدمة');
        }
      } else {
        if (editing) {
          const iconUrl = await uploadIcon(editing.id);
          const { error } = await supabase
            .from('specializations')
            .update({ label: form.label, icon: form.icon || '📋', icon_url: iconUrl })
            .eq('id', editing.id);
          if (error) throw error;
          toast.success('تم تحديث التخصص');
        } else {
          const id = crypto.randomUUID();
          const maxOrder = specializations.length > 0 ? Math.max(...specializations.map(s => s.sort_order)) : 0;
          const iconUrl = await uploadIcon(id);
          const { error } = await supabase
            .from('specializations')
            .insert({ id, label: form.label, icon: form.icon || '📋', sort_order: maxOrder + 1, icon_url: iconUrl });
          if (error) throw error;
          toast.success('تمت إضافة التخصص');
        }
      }
      setDialogOpen(false);
      loadData();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Service | Specialization, type: 'service' | 'specialization') => {
    const label = type === 'service' ? 'الخدمة' : 'التخصص';
    if (!confirm(`حذف ${label} "${item.label}"؟`)) return;
    try {
      const table = type === 'service' ? 'services' : 'specializations';
      const { error } = await supabase.from(table).delete().eq('id', item.id);
      if (error) throw error;
      toast.success(`تم حذف ${label}`);
      loadData();
    } catch (e: unknown) {
      toast.error(getUserFriendlyError(e));
    }
  };

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div>
      <Tabs defaultValue="services" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            الخدمات ({services.length})
          </TabsTrigger>
          <TabsTrigger value="specializations" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            التخصصات ({specializations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <ServicesTabContent
            services={services}
            dragId={dragId}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onAdd={() => openAdd('service')}
            onEdit={item => openEdit(item as Service, 'service')}
            onDelete={item => handleDelete(item as Service, 'service')}
          />
        </TabsContent>

        <TabsContent value="specializations">
          <SpecializationsTabContent
            specializations={specializations}
            dragId={dragId}
            onDragStart={handleSpecDragStart}
            onDragOver={handleDragOver}
            onDrop={handleSpecDrop}
            onAdd={() => openAdd('specialization')}
            onEdit={item => openEdit(item as Specialization, 'specialization')}
            onDelete={item => handleDelete(item as Specialization, 'specialization')}
          />
        </TabsContent>
      </Tabs>

      <ServiceEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dialogType={dialogType}
        editing={editing}
        form={form}
        setForm={setForm}
        iconFile={iconFile}
        iconPreview={iconPreview}
        existingIconUrl={existingIconUrl}
        saving={saving}
        fileInputRef={fileInputRef}
        onFileChange={handleFileChange}
        onRemoveIcon={removeIcon}
        onSave={handleSave}
        services={services}
      />
    </div>
  );
};

export default AdminServicesSpecs;
