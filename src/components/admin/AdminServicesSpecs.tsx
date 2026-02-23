import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Briefcase, Layers, Upload, X, ImageIcon } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/errors';

interface Service {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  description: string;
  sort_order: number;
  price: number;
  cost: number;
}

interface Specialization {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  sort_order: number;
}

const IconDisplay = ({ icon, iconUrl, size = 'md' }: { icon: string; iconUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-14 h-14' };
  const textSizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };

  if (iconUrl) {
    return <img src={iconUrl} alt="" className={`${sizeClasses[size]} rounded-lg object-cover`} />;
  }
  return <span className={textSizes[size]}>{icon}</span>;
};

const AdminServicesSpecs = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'service' | 'specialization'>('service');
  const [editing, setEditing] = useState<Service | Specialization | null>(null);
  const [form, setForm] = useState({ id: '', label: '', icon: '', description: '', price: 0, cost: 0 });
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [existingIconUrl, setExistingIconUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [{ data: svc }, { data: specs }] = await Promise.all([
      supabase.from('services').select('*').order('sort_order') as any,
      supabase.from('specializations').select('*').order('sort_order') as any,
    ]);
    setServices(svc || []);
    setSpecializations(specs || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openAdd = (type: 'service' | 'specialization') => {
    setDialogType(type);
    setEditing(null);
    setForm({ id: '', label: '', icon: '', description: '', price: 0, cost: 0 });
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
    const path = `${dialogType}/${itemId}.${ext}`;
    await supabase.storage.from('service-icons').remove([path]);
    const { error } = await supabase.storage.from('service-icons').upload(path, iconFile, { upsert: true });
    if (error) { console.error(error); return existingIconUrl; }
    const { data } = supabase.storage.from('service-icons').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!form.label.trim()) { toast.error('الاسم مطلوب'); return; }
    if (!form.icon.trim() && !iconFile && !existingIconUrl) { toast.error('الأيقونة أو الصورة مطلوبة'); return; }
    setSaving(true);

    try {
      if (dialogType === 'service') {
        if (editing) {
          const iconUrl = await uploadIcon(editing.id);
          const { error } = await supabase
            .from('services')
            .update({ label: form.label, icon: form.icon || '📄', description: form.description, icon_url: iconUrl, price: form.price, cost: form.cost } as any)
            .eq('id', editing.id);
          if (error) throw error;
          toast.success('تم تحديث الخدمة');
        } else {
          const id = form.id.trim() || form.label.trim().toLowerCase().replace(/\s+/g, '_');
          const maxOrder = services.length > 0 ? Math.max(...services.map(s => s.sort_order)) : 0;
          const iconUrl = await uploadIcon(id);
          const { error } = await supabase
            .from('services')
            .insert({ id, label: form.label, icon: form.icon || '📄', description: form.description, sort_order: maxOrder + 1, icon_url: iconUrl, price: form.price, cost: form.cost } as any);
          if (error) throw error;
          toast.success('تمت إضافة الخدمة');
        }
      } else {
        if (editing) {
          const iconUrl = await uploadIcon(editing.id);
          const { error } = await supabase
            .from('specializations')
            .update({ label: form.label, icon: form.icon || '📋', icon_url: iconUrl } as any)
            .eq('id', editing.id);
          if (error) throw error;
          toast.success('تم تحديث التخصص');
        } else {
          const id = form.id.trim() || form.label.trim().toLowerCase().replace(/\s+/g, '_');
          const maxOrder = specializations.length > 0 ? Math.max(...specializations.map(s => s.sort_order)) : 0;
          const iconUrl = await uploadIcon(id);
          const { error } = await supabase
            .from('specializations')
            .insert({ id, label: form.label, icon: form.icon || '📋', sort_order: maxOrder + 1, icon_url: iconUrl } as any);
          if (error) throw error;
          toast.success('تمت إضافة التخصص');
        }
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
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
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
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

        {/* SERVICES */}
        <TabsContent value="services">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">الخدمات المقدمة (كروت، فلايرات، الخ)</p>
            <Button onClick={() => openAdd('service')} className="rounded-xl">
              <Plus className="w-4 h-4 ml-1" />
              إضافة خدمة
            </Button>
          </div>
          <div className="space-y-2">
            {services.map((svc, i) => (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl p-4 border border-border flex items-center gap-3 group"
              >
                <IconDisplay icon={svc.icon} iconUrl={svc.icon_url} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm">{svc.label}</h4>
                  <p className="text-xs text-muted-foreground truncate">{svc.description}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground/60 font-mono">ID: {svc.id}</span>
                    {svc.price > 0 && (
                      <span className="text-[10px] font-bold text-success">سعر: {svc.price.toLocaleString('en-US')} د.ع</span>
                    )}
                    {svc.cost > 0 && (
                      <span className="text-[10px] font-bold text-destructive">تكلفة: {svc.cost.toLocaleString('en-US')} د.ع</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(svc, 'service')}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(svc, 'service')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* SPECIALIZATIONS */}
        <TabsContent value="specializations">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">تخصصات مجالات الأعمال</p>
            <Button onClick={() => openAdd('specialization')} className="rounded-xl">
              <Plus className="w-4 h-4 ml-1" />
              إضافة تخصص
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {specializations.map((spec, i) => (
              <motion.div
                key={spec.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card rounded-xl p-4 border border-border flex items-center gap-3 group"
              >
                <IconDisplay icon={spec.icon} iconUrl={spec.icon_url} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm">{spec.label}</h4>
                  <span className="text-[10px] text-muted-foreground/60 font-mono">ID: {spec.id}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(spec, 'specialization')}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(spec, 'specialization')}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'تعديل' : 'إضافة'} {dialogType === 'service' ? 'خدمة' : 'تخصص'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {!editing && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">المعرّف (ID) — اختياري</label>
                <Input
                  value={form.id}
                  onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                  placeholder="مثال: beauty_salon (يُولّد تلقائياً)"
                  className="rounded-xl font-mono text-sm"
                  dir="ltr"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الاسم *</label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder={dialogType === 'service' ? 'مثال: كروت شخصية' : 'مثال: أطباء'}
                className="rounded-xl"
              />
            </div>

            {/* Icon Section: Emoji OR Image */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">الأيقونة *</label>
              <div className="grid grid-cols-2 gap-3">
                {/* Emoji input */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">إيموجي</p>
                  <Input
                    value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    placeholder="💳"
                    className="rounded-xl text-2xl text-center h-14"
                    dir="ltr"
                  />
                </div>

                {/* Image upload */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">أو صورة</p>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  {iconPreview || existingIconUrl ? (
                    <div className="relative h-14 rounded-xl border border-border overflow-hidden bg-muted/30 flex items-center justify-center">
                      <img src={iconPreview || existingIconUrl!} alt="" className="h-full w-full object-contain p-1" />
                      <button
                        onClick={removeIcon}
                        className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="h-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                    >
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">رفع صورة</span>
                    </div>
                  )}
                </div>
              </div>
              {(iconPreview || existingIconUrl) && (
                <p className="text-[11px] text-primary mt-1.5">✓ سيتم استخدام الصورة بدلاً من الإيموجي</p>
              )}
            </div>

            {dialogType === 'service' && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">الوصف</label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="وصف مختصر للخدمة..."
                    className="rounded-xl min-h-[80px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">السعر (لكل 1000)</label>
                    <Input
                      type="number"
                      value={form.price || ''}
                      onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))}
                      placeholder="25000"
                      className="rounded-xl"
                      dir="ltr"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">التكلفة (لكل 1000)</label>
                    <Input
                      type="number"
                      value={form.cost || ''}
                      onChange={e => setForm(f => ({ ...f, cost: parseInt(e.target.value) || 0 }))}
                      placeholder="10000"
                      className="rounded-xl"
                      dir="ltr"
                      min="0"
                    />
                  </div>
                </div>
                {form.price > 0 && form.cost > 0 && (
                  form.cost > form.price ? (
                    <p className="text-[11px] text-destructive">
                      ⚠ التكلفة أعلى من السعر! الخسارة: {(form.cost - form.price).toLocaleString('en-US')} د.ع لكل ألف
                    </p>
                  ) : (
                    <p className="text-[11px] text-success">
                      ✓ هامش الربح: {((form.price - form.cost) / form.price * 100).toFixed(0)}% — صافي {(form.price - form.cost).toLocaleString('en-US')} د.ع لكل ألف
                    </p>
                  )
                )}
              </>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
                {saving ? 'جاري الحفظ...' : editing ? 'حفظ التغييرات' : 'إضافة'}
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

export default AdminServicesSpecs;
