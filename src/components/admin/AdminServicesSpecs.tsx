import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, Briefcase, Layers } from 'lucide-react';
import { getUserFriendlyError } from '@/lib/errors';

interface Service {
  id: string;
  label: string;
  icon: string;
  description: string;
  sort_order: number;
}

interface Specialization {
  id: string;
  label: string;
  icon: string;
  sort_order: number;
}

const AdminServicesSpecs = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'service' | 'specialization'>('service');
  const [editing, setEditing] = useState<Service | Specialization | null>(null);
  const [form, setForm] = useState({ id: '', label: '', icon: '', description: '' });
  const [saving, setSaving] = useState(false);

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
    setForm({ id: '', label: '', icon: '', description: '' });
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
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) { toast.error('الاسم مطلوب'); return; }
    if (!form.icon.trim()) { toast.error('الأيقونة مطلوبة'); return; }
    setSaving(true);

    try {
      if (dialogType === 'service') {
        if (editing) {
          const { error } = await supabase
            .from('services')
            .update({ label: form.label, icon: form.icon, description: form.description } as any)
            .eq('id', editing.id);
          if (error) throw error;
          toast.success('تم تحديث الخدمة');
        } else {
          const id = form.id.trim() || form.label.trim().toLowerCase().replace(/\s+/g, '_');
          const maxOrder = services.length > 0 ? Math.max(...services.map(s => s.sort_order)) : 0;
          const { error } = await supabase
            .from('services')
            .insert({ id, label: form.label, icon: form.icon, description: form.description, sort_order: maxOrder + 1 } as any);
          if (error) throw error;
          toast.success('تمت إضافة الخدمة');
        }
      } else {
        if (editing) {
          const { error } = await supabase
            .from('specializations')
            .update({ label: form.label, icon: form.icon } as any)
            .eq('id', editing.id);
          if (error) throw error;
          toast.success('تم تحديث التخصص');
        } else {
          const id = form.id.trim() || form.label.trim().toLowerCase().replace(/\s+/g, '_');
          const maxOrder = specializations.length > 0 ? Math.max(...specializations.map(s => s.sort_order)) : 0;
          const { error } = await supabase
            .from('specializations')
            .insert({ id, label: form.label, icon: form.icon, sort_order: maxOrder + 1 } as any);
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
                <span className="text-2xl">{svc.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground text-sm">{svc.label}</h4>
                  <p className="text-xs text-muted-foreground truncate">{svc.description}</p>
                  <span className="text-[10px] text-muted-foreground/60 font-mono">ID: {svc.id}</span>
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
                <span className="text-2xl">{spec.icon}</span>
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
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الأيقونة (Emoji) *</label>
              <Input
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="مثال: 💳"
                className="rounded-xl text-2xl text-center"
                dir="ltr"
              />
            </div>
            {dialogType === 'service' && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">الوصف</label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="وصف مختصر للخدمة..."
                  className="rounded-xl min-h-[80px]"
                />
              </div>
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
