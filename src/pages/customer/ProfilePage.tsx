import { useState, useEffect } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  useProfileQuery,
  useSavedAddressesQuery,
  useUpdateProfileMutation,
  useSaveAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
} from '@/hooks/queries/useProfileQuery';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Phone, MapPin, Save, Landmark, Plus, Trash2, Pencil, Star, CheckCircle2, X, ShieldCheck, LogOut, Fingerprint } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { biometricSupported, biometricEnabled, enableBiometric, disableBiometric } from '@/lib/biometric';
import { cn } from '@/lib/utils';
import LocationSelect, { type LocationValue, emptyLocation } from '@/components/LocationSelect';
import ChangePhoneDialog from '@/components/ChangePhoneDialog';
import { isNativeApp } from '@/lib/platform';

type Tab = 'profile' | 'addresses';

interface SavedAddress {
  id: string;
  label: string;
  phone: string;
  province: string;
  area: string;
  province_id?: number | null;
  area_id?: number | null;
  landmark: string | null;
  is_default: boolean;
}

const emptyForm = () => ({ label: '', phone: '', location: emptyLocation(), landmark: '' });

const ProfilePage = () => {
  const { user, signOut, phoneLogin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // ── Biometric login toggle (native only, if hardware supports it) ──
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioPinOpen, setBioPinOpen] = useState(false);
  const [bioPin, setBioPin] = useState('');

  useEffect(() => {
    if (!isNativeApp) return;
    biometricSupported().then(setBioSupported);
    biometricEnabled().then(setBioEnabled);
  }, []);

  const toggleBiometric = async (next: boolean) => {
    if (next) {
      // Enabling needs the PIN (so biometric login can re-authenticate). Ask for it.
      setBioPin('');
      setBioPinOpen(true);
      return;
    }
    setBioBusy(true);
    try {
      await disableBiometric();
      setBioEnabled(false);
      toast({ title: 'تم إيقاف تسجيل الدخول بالبصمة' });
    } finally {
      setBioBusy(false);
    }
  };

  // Confirm enabling: verify the entered PIN, then biometric-confirm and store it.
  const confirmEnableBio = async () => {
    if (bioPin.length < 6) return;
    setBioBusy(true);
    try {
      const { error } = await phoneLogin(phone, bioPin); // validates the PIN (re-auths same user)
      if (error) {
        setBioPin('');
        toast({ title: 'الرمز غير صحيح', variant: 'destructive' });
        return;
      }
      const ok = await enableBiometric(phone, bioPin);
      setBioEnabled(ok);
      setBioPinOpen(false);
      setBioPin('');
      toast(ok
        ? { title: 'تم تفعيل تسجيل الدخول بالبصمة ✓' }
        : { title: 'تعذّر التفعيل', description: 'لم يتم التحقق من البصمة', variant: 'destructive' });
    } finally {
      setBioBusy(false);
    }
  };
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // ── Profile fields ──
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<LocationValue>(emptyLocation());
  const [landmark, setLandmark] = useState('');
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);

  // ── Saved addresses (form state only) ──
  const [editingId, setEditingId] = useState<string | null>(null); // null = add new
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [formSaving, setFormSaving] = useState(false);

  // ── React Query: server state ──
  const profileQuery = useProfileQuery(user?.id);
  const savedAddressesQuery = useSavedAddressesQuery(user?.id, activeTab === 'addresses');
  const updateProfileMutation = useUpdateProfileMutation();
  const saveAddressMutation = useSaveAddressMutation(user?.id ?? '');
  const deleteAddressMutation = useDeleteAddressMutation(user?.id ?? '');
  const setDefaultAddressMutation = useSetDefaultAddressMutation(user?.id ?? '');

  // Derived display values from query results
  const loading = profileQuery.isLoading;
  const addresses = (savedAddressesQuery.data ?? []) as SavedAddress[];
  // Show spinner both on first load and while a post-mutation refetch is in flight —
  // matches the original behaviour where loadAddresses() always showed the spinner.
  const addrLoading = savedAddressesQuery.isFetching;

  // Sync profile data from React Query into local form state once available
  useEffect(() => {
    const data = profileQuery.data;
    if (!data) return;
    setDisplayName(data.display_name || '');
    setPhone(data.phone || '');
    setLocation({
      provinceId: (data as { province_id?: number | null }).province_id ?? null,
      provinceName: data.province || '',
      areaId: (data as { area_id?: number | null }).area_id ?? null,
      areaName: data.area || '',
    });
    setLandmark(data.landmark || '');
  }, [profileQuery.data]);

  // ── Profile save ──
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedName = displayName.trim();
    const trimmedPhone = phone.trim();
    const trimmedProvince = location.provinceName.trim();
    const trimmedArea = location.areaName.trim();
    const trimmedLandmark = landmark.trim();

    if (!trimmedName) { toast({ title: 'الاسم مطلوب', variant: 'destructive' }); return; }
    if (!trimmedPhone) { toast({ title: 'رقم الهاتف مطلوب', variant: 'destructive' }); return; }
    if (!trimmedProvince) { toast({ title: 'المحافظة مطلوبة', variant: 'destructive' }); return; }
    if (!trimmedArea) { toast({ title: 'المنطقة مطلوبة', variant: 'destructive' }); return; }
    if (!trimmedLandmark) { toast({ title: 'العلامة الدالة مطلوبة', variant: 'destructive' }); return; }

    setSaving(true);
    // Phone is intentionally excluded — it's the login identity and can only be changed via the
    // OTP-verified flow (ChangePhoneDialog), never through this general save.
    const result = await updateProfileMutation.mutateAsync({
      userId: user.id,
      payload: {
        display_name: trimmedName,
        province: trimmedProvince, area: trimmedArea,
        province_id: location.provinceId, area_id: location.areaId,
        landmark: trimmedLandmark,
      },
    });
    setSaving(false);
    if (result.error) toast({ title: 'خطأ في الحفظ', description: result.error.message, variant: 'destructive' });
    else toast({ title: 'تم الحفظ بنجاح', description: 'تم تحديث بياناتك الشخصية' });
  };

  // ── Address actions ──
  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setForm({
      label: addr.label,
      phone: addr.phone,
      location: {
        provinceId: addr.province_id ?? null,
        provinceName: addr.province,
        areaId: addr.area_id ?? null,
        areaName: addr.area,
      },
      landmark: addr.landmark || '',
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm()); };

  const handleSaveAddress = async () => {
    if (!form.phone.trim() || !form.location.provinceName.trim() || !form.location.areaName.trim()) {
      toast({ title: 'يرجى تعبئة الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setFormSaving(true);

    const payload = {
      user_id: user.id,
      label: form.label.trim() || 'عنوان جديد',
      phone: form.phone.trim(),
      province: form.location.provinceName.trim(),
      area: form.location.areaName.trim(),
      province_id: form.location.provinceId,
      area_id: form.location.areaId,
      landmark: form.landmark.trim() || null,
    };

    const saveResult = await saveAddressMutation.mutateAsync({
      editingId,
      payload,
      isDefault: addresses.length === 0,
    });
    if (!saveResult.error) {
      toast({ title: editingId ? 'تم تعديل العنوان' : 'تم إضافة العنوان' });
    } else {
      toast({ title: editingId ? 'خطأ في التعديل' : 'خطأ في الإضافة', variant: 'destructive' });
    }

    setFormSaving(false);
    closeForm();
    // addresses list refreshes automatically via invalidateQueries in the mutation hook
  };

  const handleDelete = async (id: string) => {
    await deleteAddressMutation.mutateAsync(id);
    toast({ title: 'تم حذف العنوان' });
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    // Remove default from all, then set on selected
    await setDefaultAddressMutation.mutateAsync(id);
    toast({ title: 'تم تعيين العنوان الافتراضي ⭐' });
  };

  if (loading) {
    return (
      <div className={isNativeApp ? 'flex items-center justify-center py-16' : 'flex items-center justify-center min-h-[50vh]'}>
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
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
                      <div className="flex items-center gap-2">
                        <Input
                          type="tel"
                          value={phone}
                          readOnly
                          dir="ltr"
                          className="text-left bg-muted/50 text-muted-foreground cursor-not-allowed flex-1"
                          tabIndex={-1}
                          aria-readonly="true"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPhoneDialogOpen(true)}
                          className="h-10 shrink-0 gap-1.5 text-primary"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          تغيير
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        تغيير الرقم يتطلب التحقق برمز يُرسل إلى الرقم الجديد.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-foreground text-sm font-semibold">
                        <MapPin className="w-4 h-4 text-primary" /> العنوان الافتراضي
                      </div>
                      <LocationSelect value={location} onChange={setLocation} disabled={saving} className="sm:grid-cols-1" />
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

                      <LocationSelect
                        compact
                        value={form.location}
                        onChange={loc => setForm(f => ({ ...f, location: loc }))}
                        disabled={formSaving}
                        className="sm:grid-cols-1"
                      />

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

          {/* Biometric login toggle (device only) */}
          {isNativeApp && bioSupported && (
            <div className="mt-6 bg-card rounded-2xl border border-border/60 shadow-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground text-sm">تسجيل الدخول بالبصمة</p>
                  <p className="text-muted-foreground text-xs mt-0.5">ادخل بسرعة باستخدام بصمتك بدل إدخال الرمز</p>
                </div>
              </div>
              <Switch checked={bioEnabled} disabled={bioBusy} onCheckedChange={toggleBiometric} />
            </div>
          )}

          {/* Sign out */}
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full h-12 mt-6 gap-2 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </Button>
        </motion.div>
      </div>

      <ChangePhoneDialog
        open={phoneDialogOpen}
        onOpenChange={setPhoneDialogOpen}
        currentPhone={phone}
        onChanged={setPhone}
      />

      {/* PIN prompt to enable biometric login */}
      <Dialog open={bioPinOpen} onOpenChange={(o) => { if (!o && !bioBusy) { setBioPinOpen(false); setBioPin(''); } }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center text-base">أدخل رمزك لتفعيل البصمة</DialogTitle>
          </DialogHeader>
          <p className="text-center text-xs text-muted-foreground -mt-1">سنستخدمه لتسجيل دخولك ببصمتك لاحقاً</p>
          <div dir="ltr" className="py-2">
            <InputOTP maxLength={6} value={bioPin} onChange={setBioPin} containerClassName="w-full" autoFocus>
              <InputOTPGroup className="flex w-full gap-2">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <InputOTPSlot key={i} index={i} className="h-12 flex-1 !rounded-xl !border border-input bg-background/50 text-lg font-bold" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button onClick={confirmEnableBio} disabled={bioPin.length < 6 || bioBusy} className="w-full h-11">
            {bioBusy ? 'جاري التفعيل...' : 'تفعيل'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
