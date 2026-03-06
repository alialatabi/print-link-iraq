import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Briefcase, Layers, Upload, X, ImageIcon, GripVertical } from 'lucide-react';
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
  parent_id: string | null;
  completion_days: number;
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
  const [form, setForm] = useState({ id: '', label: '', icon: '', description: '', price: 0, cost: 0, parent_id: '', completion_days: 0, min_quantity: 1, cellophane_type: 'none' });
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
    setForm({ id: '', label: '', icon: '', description: '', price: 0, cost: 0, parent_id: '', completion_days: 0, min_quantity: 1, cellophane_type: 'none' });
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
      min_quantity: 'min_quantity' in item ? ((item as any).min_quantity || 1) : 1,
      cellophane_type: 'cellophane_type' in item ? ((item as any).cellophane_type || 'none') : 'none',
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
    // Use a safe filename: replace non-ASCII chars and add timestamp
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
    setSaving(true);

    try {
      if (dialogType === 'service') {
        if (editing) {
          const iconUrl = await uploadIcon(editing.id);
          const { error } = await supabase
            .from('services')
            .update({ label: form.label, icon: form.icon || '📄', description: form.description, icon_url: iconUrl, price: form.price, cost: form.cost, parent_id: form.parent_id || null, completion_days: form.completion_days, min_quantity: form.min_quantity, cellophane_type: form.cellophane_type } as any)
            .eq('id', editing.id);
          if (error) throw error;
          toast.success('تم تحديث الخدمة');
        } else {
          const id = crypto.randomUUID();
          const maxOrder = services.length > 0 ? Math.max(...services.map(s => s.sort_order)) : 0;
          const iconUrl = await uploadIcon(id);
          const { error } = await supabase
            .from('services')
            .insert({ id, label: form.label, icon: form.icon || '📄', description: form.description, sort_order: maxOrder + 1, icon_url: iconUrl, price: form.price, cost: form.cost, parent_id: form.parent_id || null, completion_days: form.completion_days, min_quantity: form.min_quantity, cellophane_type: form.cellophane_type } as any);
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
          const id = crypto.randomUUID();
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
            <p className="text-sm text-muted-foreground">الخدمات العامة والفرعية</p>
            <Button onClick={() => openAdd('service')} className="rounded-xl">
              <Plus className="w-4 h-4 ml-1" />
              إضافة خدمة
            </Button>
          </div>
          <div className="space-y-2">
            {services.filter(s => !s.parent_id).map((parent, i) => {
              const children = services.filter(s => s.parent_id === parent.id);
              return (
                <div key={parent.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card rounded-xl p-4 border border-border flex items-center gap-3 group"
                  >
                    <IconDisplay icon={parent.icon} iconUrl={parent.icon_url} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-sm">{parent.label}</h4>
                      
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground/60 font-mono">ID: {parent.id}</span>
                        <span className="text-[10px] font-bold text-primary">خدمة عامة • {children.length} فرعية</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(parent, 'service')}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(parent, 'service')}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                  {/* Sub-services */}
                  {children.length > 0 && (
                    <div className="mr-8 mt-1 space-y-1 border-r-2 border-primary/20 pr-3">
                      {children.map((child, j) => (
                        <motion.div
                          key={child.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: (i * 0.03) + (j * 0.02) }}
                          className="bg-muted/40 rounded-lg p-3 border border-border/60 flex items-center gap-3 group"
                        >
                          <IconDisplay icon={child.icon} iconUrl={child.icon_url} size="sm" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground text-xs">{child.label}</h4>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] text-muted-foreground/60 font-mono">ID: {child.id}</span>
                              {child.price > 0 && (
                                <span className="text-[10px] font-bold text-success">سعر: {child.price.toLocaleString('en-US')} د.ع</span>
                              )}
                              {child.cost > 0 && (
                                <span className="text-[10px] font-bold text-destructive">تكلفة: {child.cost.toLocaleString('en-US')} د.ع</span>
                              )}
                              {child.completion_days > 0 && (
                                <span className="text-[10px] font-bold text-blue-500">⏱ {child.completion_days} {child.completion_days === 1 ? 'يوم' : 'أيام'}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(child, 'service')}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(child, 'service')}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الاسم *</label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder={dialogType === 'service' ? 'مثال: كروت شخصية' : 'مثال: أطباء'}
                className="rounded-xl"
              />
            </div>

            {/* Icon Section */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                {dialogType === 'service' ? 'صورة الأيقونة *' : 'الأيقونة *'}
              </label>
              {dialogType === 'specialization' && (
                <div className="grid grid-cols-2 gap-3">
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
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">أو صورة</p>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    {iconPreview || existingIconUrl ? (
                      <div className="relative h-14 rounded-xl border border-border overflow-hidden bg-muted/30 flex items-center justify-center">
                        <img src={iconPreview || existingIconUrl!} alt="" className="h-full w-full object-contain p-1" />
                        <button onClick={removeIcon} className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div onClick={() => fileInputRef.current?.click()} className="h-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all">
                        <Upload className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">رفع صورة</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {dialogType === 'service' && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  {iconPreview || existingIconUrl ? (
                    <div className="relative h-20 w-20 rounded-xl border border-border overflow-hidden bg-muted/30 flex items-center justify-center">
                      <img src={iconPreview || existingIconUrl!} alt="" className="h-full w-full object-contain p-1" />
                      <button onClick={removeIcon} className="absolute top-1 left-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div onClick={() => fileInputRef.current?.click()} className="h-20 w-full rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">اضغط لرفع صورة</span>
                    </div>
                  )}
                </>
              )}
              {(iconPreview || existingIconUrl) && dialogType === 'specialization' && (
                <p className="text-[11px] text-primary mt-1.5">✓ سيتم استخدام الصورة بدلاً من الإيموجي</p>
              )}
            </div>

            {dialogType === 'service' && (
              <>
                {/* Parent service selector */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">تابعة لخدمة عامة (اتركها فارغة لجعلها خدمة عامة)</label>
                  <select
                    value={form.parent_id}
                    onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">— خدمة عامة (رئيسية) —</option>
                    {services.filter(s => !s.parent_id && s.id !== form.id).map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {/* Only show price/cost for sub-services */}
                {form.parent_id && (
                  <>
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
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">فترة الإنجاز (بالأيام)</label>
                      <Input
                        type="number"
                        value={form.completion_days || ''}
                        onChange={e => setForm(f => ({ ...f, completion_days: parseInt(e.target.value) || 0 }))}
                        placeholder="3"
                        className="rounded-xl"
                        dir="ltr"
                        min="0"
                      />
                      {form.completion_days > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">⏱ يتم إنجاز الطلب خلال {form.completion_days} {form.completion_days === 1 ? 'يوم' : 'أيام'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">أقل كمية للطلب</label>
                      <Input
                        type="number"
                        value={form.min_quantity || ''}
                        onChange={e => setForm(f => ({ ...f, min_quantity: parseInt(e.target.value) || 1 }))}
                        placeholder="1000"
                        className="rounded-xl"
                        dir="ltr"
                        min="1"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">الحد الأدنى: {form.min_quantity.toLocaleString('en-US')} نسخة</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">السيلفان</label>
                      <select
                        value={form.cellophane_type}
                        onChange={e => setForm(f => ({ ...f, cellophane_type: e.target.value }))}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
                      >
                        <option value="none">بدون سيلفان</option>
                        <option value="matte">طافي فقط</option>
                        <option value="glossy">لمّاع فقط</option>
                        <option value="both">طافي ولمّاع (يختار الزبون)</option>
                      </select>
                    </div>
                  </>
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
