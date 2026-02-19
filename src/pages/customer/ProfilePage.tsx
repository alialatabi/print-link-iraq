import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Phone, MapPin, Save, Building2, Navigation, Landmark, Plus, Trash2, Pencil, Star, CheckCircle2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'addresses';

interface SavedAddress {
  id: string;
  label: string;
  phone: string;
  province: string;
  area: string;
  landmark: string | null;
  is_default: boolean;
}

const emptyForm = () => ({ label: '', phone: '', province: '', area: '', landmark: '' });

const ProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // ── Profile fields ──
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');

  // ── Saved addresses ──
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = add new
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formSaving, setFormSaving] = useState(false);

  // Load profile
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (data) {
        setDisplayName(data.display_name || '');
        setPhone(data.phone || '');
        setProvince(data.province || '');
        setArea(data.area || '');
        setLandmark(data.landmark || '');
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Load addresses
  const loadAddresses = useCallback(async () => {
    if (!user) return;
    setAddrLoading(true);
    const { data } = await supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });
    setAddresses((data as SavedAddress[]) || []);
    setAddrLoading(false);
  }, [user]);

  useEffect(() => {
    if (activeTab === 'addresses') loadAddresses();
  }, [activeTab, loadAddresses]);

  // ── Profile save ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedName = displayName.trim();
    const trimmedPhone = phone.trim();
    const trimmedProvince = province.trim();
    const trimmedArea = area.trim();
    const trimmedLandmark = landmark.trim();

    if (!trimmedName) { toast({ title: 'الاسم مطلوب', variant: 'destructive' }); return; }
    if (!trimmedPhone) { toast({ title: 'رقم الهاتف مطلوب', variant: 'destructive' }); return; }
    if (!trimmedProvince) { toast({ title: 'المحافظة مطلوبة', variant: 'destructive' }); return; }
    if (!trimmedArea) { toast({ title: 'المنطقة مطلوبة', variant: 'destructive' }); return; }
    if (!trimmedLandmark) { toast({ title: 'العلامة الدالة مطلوبة', variant: 'destructive' }); return; }

    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      display_name: trimmedName, phone: trimmedPhone,
      province: trimmedProvince, area: trimmedArea, landmark: trimmedLandmark,
    }).eq('user_id', user.id);
    setSaving(false);
    if (error) toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    else toast({ title: 'تم الحفظ بنجاح', description: 'تم تحديث بياناتك الشخصية' });
  };

  // ── Address actions ──
  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setForm({ label: addr.label, phone: addr.phone, province: addr.province, area: addr.area, landmark: addr.landmark || '' });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm()); };

  const handleSaveAddress = async () => {
    if (!form.phone.trim() || !form.province.trim() || !form.area.trim()) {
      toast({ title: 'يرجى تعبئة الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setFormSaving(true);

    const payload = {
      user_id: user.id,
      label: form.label.trim() || 'عنوان جديد',
      phone: form.phone.trim(),
      province: form.province.trim(),
      area: form.area.trim(),
      landmark: form.landmark.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from('saved_addresses').update(payload).eq('id', editingId);
      if (!error) toast({ title: 'تم تعديل العنوان' });
      else toast({ title: 'خطأ في التعديل', variant: 'destructive' });
    } else {
      const { error } = await supabase.from('saved_addresses').insert({ ...payload, is_default: addresses.length === 0 });
      if (!error) toast({ title: 'تم إضافة العنوان' });
      else toast({ title: 'خطأ في الإضافة', variant: 'destructive' });
    }

    setFormSaving(false);
    closeForm();
    loadAddresses();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('saved_addresses').delete().eq('id', id);
    toast({ title: 'تم حذف العنوان' });
    loadAddresses();
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    // Remove default from all, then set on selected
    await supabase.from('saved_addresses').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('saved_addresses').update({ is_default: true }).eq('id', id);
    toast({ title: 'تم تعيين العنوان الافتراضي ⭐' });
    loadAddresses();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-lg">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">الملف الشخصي</h1>
              <p className="text-muted-foreground text-sm">عدّل بياناتك ومعلومات التوصيل</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1 mb-6">
            {([['profile', 'البيانات الشخصية', User], ['addresses', 'العناوين المحفوظة', MapPin]] as const).map(([tab, label, Icon]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200',
                  activeTab === tab
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Profile Tab ── */}
          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.div key="profile" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <div className="bg-card rounded-2xl border border-border/60 p-6 sm:p-8 shadow-card">
                  <form onSubmit={handleSave} className="space-y-6">
                    <div>
                      <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-muted-foreground" /> الاسم <span className="text-destructive">*</span>
                      </Label>
                      <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="اسمك الكامل" className="text-right" maxLength={100} required />
                    </div>
                    <div>
                      <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                        <Phone className="w-4 h-4 text-muted-foreground" /> رقم الهاتف <span className="text-destructive">*</span>
                      </Label>
                      <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xxxxxxxxx" dir="ltr" className="text-left" maxLength={20} required />
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-foreground text-sm font-semibold">
                        <MapPin className="w-4 h-4 text-primary" /> العنوان الافتراضي
                      </div>
                      <div>
                        <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" /> المحافظة <span className="text-destructive">*</span>
                        </Label>
                        <Input value={province} onChange={e => setProvince(e.target.value)} placeholder="مثال: بغداد" className="text-right" maxLength={100} required />
                      </div>
                      <div>
                        <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                          <Navigation className="w-4 h-4 text-muted-foreground" /> المنطقة <span className="text-destructive">*</span>
                        </Label>
                        <Input value={area} onChange={e => setArea(e.target.value)} placeholder="مثال: الكرادة" className="text-right" maxLength={150} required />
                      </div>
                      <div>
                        <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                          <Landmark className="w-4 h-4 text-muted-foreground" /> أقرب علامة دالة <span className="text-destructive">*</span>
                        </Label>
                        <Input value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="مثال: قرب مول المنصور" className="text-right" maxLength={200} required />
                      </div>
                    </div>
                    <div className="pt-3">
                      <p className="text-xs text-muted-foreground mb-5">البريد: {user?.email || '—'}</p>
                      <Button type="submit" disabled={saving} className="w-full h-12" size="lg">
                        {saving ? 'جاري الحفظ...' : <><Save className="w-4 h-4 ml-2" />حفظ التعديلات</>}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* ── Addresses Tab ── */}
            {activeTab === 'addresses' && (
              <motion.div key="addresses" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
                {addrLoading ? (
                  <div className="py-12 flex justify-center">
                    <div className="animate-spin w-7 h-7 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : addresses.length === 0 && !showForm ? (
                  <div className="bg-card rounded-2xl border border-border/60 p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <MapPin className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-foreground font-medium text-sm mb-1">لا توجد عناوين محفوظة</p>
                    <p className="text-muted-foreground text-xs">أضف عنواناً لتوصيل طلباتك بسهولة</p>
                  </div>
                ) : (
                  addresses.map(addr => (
                    <motion.div key={addr.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-card rounded-2xl border border-border/60 p-5 shadow-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <p className="font-semibold text-foreground text-sm">{addr.label}</p>
                            {addr.is_default && (
                              <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                                <Star className="w-2.5 h-2.5 fill-amber-500" /> افتراضي
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                              <Phone className="w-3 h-3 flex-shrink-0" />
                              <span dir="ltr">{addr.phone}</span>
                            </p>
                            <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {addr.province} — {addr.area}{addr.landmark ? ` — ${addr.landmark}` : ''}
                            </p>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!addr.is_default && (
                            <button
                              onClick={() => handleSetDefault(addr.id)}
                              title="تعيين كافتراضي"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-amber-500/8 transition-all"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(addr)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(addr.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}

                {/* Add/Edit form */}
                <AnimatePresence>
                  {showForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-card rounded-2xl border border-primary/20 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground text-sm">
                          {editingId ? 'تعديل العنوان' : 'إضافة عنوان جديد'}
                        </p>
                        <button onClick={closeForm} className="text-muted-foreground hover:text-foreground transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">اسم العنوان</Label>
                        <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="البيت، العمل..." className="text-right" maxLength={50} />
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                          <Phone className="w-3 h-3" /> رقم الهاتف <span className="text-destructive">*</span>
                        </Label>
                        <Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="07xxxxxxxxx" dir="ltr" maxLength={20} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> المحافظة <span className="text-destructive">*</span>
                          </Label>
                          <Input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} placeholder="بغداد" className="text-right" maxLength={100} />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                            <Navigation className="w-3 h-3" /> المنطقة <span className="text-destructive">*</span>
                          </Label>
                          <Input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="الكرادة" className="text-right" maxLength={150} />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                          <Landmark className="w-3 h-3" /> أقرب علامة دالة
                        </Label>
                        <Input value={form.landmark} onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))} placeholder="قرب مول المنصور" className="text-right" maxLength={200} />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button onClick={handleSaveAddress} disabled={formSaving} className="flex-1" size="sm">
                          <CheckCircle2 className="w-4 h-4 ml-1" />
                          {formSaving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة العنوان'}
                        </Button>
                        <Button variant="outline" onClick={closeForm} size="sm">إلغاء</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Add button */}
                {!showForm && (
                  <button
                    onClick={openAdd}
                    className="w-full border-2 border-dashed border-border/50 hover:border-primary/40 rounded-2xl p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all duration-200"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">إضافة عنوان جديد</span>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
