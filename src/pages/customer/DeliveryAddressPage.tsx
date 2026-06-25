import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { MapPin, Phone, Landmark, Plus, CheckCircle2, Star, Trash2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import LocationSelect, { type LocationValue, emptyLocation } from '@/components/LocationSelect';

interface SavedAddress {
  id: string;
  label: string;
  phone: string;
  province: string;
  area: string;
  landmark: string | null;
  is_default: boolean;
}

const DeliveryAddressPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // New address form
  const [label, setLabel] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<LocationValue>(emptyLocation());
  const [landmark, setLandmark] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Load profile (default address)
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, province, area, landmark')
      .eq('user_id', user.id)
      .maybeSingle();

    // Load saved addresses
    const { data: addresses } = await supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    const list: SavedAddress[] = [];

    // Add profile as default if complete
    if (profile?.phone && profile?.province && profile?.area) {
      list.push({
        id: '__profile__',
        label: 'العنوان الافتراضي',
        phone: profile.phone,
        province: profile.province,
        area: profile.area,
        landmark: profile.landmark || null,
        is_default: true,
      });
    }

    list.push(...(addresses as SavedAddress[] || []));
    setSavedAddresses(list);

    // Auto-select default
    if (list.length > 0) setSelectedId(list[0].id);
    else setShowNewForm(true);

    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConfirm = async () => {
    if (!orderId || !user) return;
    const selected = savedAddresses.find(a => a.id === selectedId);
    if (!selected) return;

    setSubmitting(true);

    // Fetch current order details to merge
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('details')
      .eq('id', orderId)
      .single();

    const currentDetails = (currentOrder?.details || {}) as Record<string, any>;

    // Update order with delivery info and set status to approved (merge with existing details)
    const { error } = await supabase.from('orders').update({
      status: 'approved' as any,
      details: {
        ...currentDetails,
        delivery_phone: selected.phone,
        delivery_province: selected.province,
        delivery_area: selected.area,
        delivery_landmark: selected.landmark,
        delivery_label: selected.label,
        approved_at: new Date().toISOString(),
      },
    }).eq('id', orderId);

    if (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    toast({ title: 'تمت الموافقة وتأكيد عنوان الاستلام ✅' });
    navigate(`/track-order/${orderId}`);
  };

  const handleAddNew = async () => {
    if (!phone.trim() || !location.provinceName.trim() || !location.areaName.trim()) {
      toast({ title: 'يرجى تعبئة الحقول المطلوبة', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setSubmitting(true);

    const newAddr = {
      user_id: user.id,
      label: label.trim() || 'عنوان جديد',
      phone: phone.trim(),
      province: location.provinceName.trim(),
      area: location.areaName.trim(),
      province_id: location.provinceId,
      area_id: location.areaId,
      landmark: landmark.trim() || null,
      is_default: false,
    };

    if (saveAddress) {
      const { data, error } = await supabase
        .from('saved_addresses')
        .insert(newAddr as never)
        .select()
        .single();
      if (!error && data) {
        const updated = [...savedAddresses, data as SavedAddress];
        setSavedAddresses(updated);
        setSelectedId((data as SavedAddress).id);
        toast({ title: 'تم حفظ العنوان' });
      }
    } else {
      // Temp address not saved
      const temp: SavedAddress = { id: '__temp__', ...newAddr, landmark: newAddr.landmark || null };
      setSavedAddresses(prev => [...prev.filter(a => a.id !== '__temp__'), temp]);
      setSelectedId('__temp__');
    }

    setShowNewForm(false);
    setLabel(''); setPhone(''); setLocation(emptyLocation()); setLandmark('');
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('saved_addresses').delete().eq('id', id);
    const updated = savedAddresses.filter(a => a.id !== id);
    setSavedAddresses(updated);
    if (selectedId === id) setSelectedId(updated[0]?.id || null);
    toast({ title: 'تم حذف العنوان' });
  };

  if (loading) return (
    <div className="py-24 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
    </div>
  );

  const selectedAddr = savedAddresses.find(a => a.id === selectedId);

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-lg">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-success" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">عنوان الاستلام</h1>
              <p className="text-muted-foreground text-sm">اختر العنوان الذي تريد استلام طلبك منه</p>
            </div>
          </div>

          {/* Saved Addresses */}
          {savedAddresses.length > 0 && (
            <div className="space-y-3 mb-5">
              {savedAddresses.map(addr => (
                <motion.div
                  key={addr.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedId(addr.id)}
                  className={cn(
                    'rounded-2xl p-5 border-2 cursor-pointer transition-all duration-200',
                    selectedId === addr.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/50 bg-card hover:border-primary/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Selection indicator */}
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all',
                        selectedId === addr.id ? 'border-primary bg-primary' : 'border-border'
                      )}>
                        {selectedId === addr.id && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="font-semibold text-foreground text-sm">{addr.label}</p>
                          {addr.is_default && (
                            <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-medium">
                              <Star className="w-2.5 h-2.5" /> افتراضي
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{addr.phone}</span>
                          </p>
                          <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" />
                            {addr.province} — {addr.area}
                            {addr.landmark && ` — ${addr.landmark}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    {addr.id !== '__profile__' && addr.id !== '__temp__' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(addr.id); }}
                        className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Add New Address */}
          {!showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full border-2 border-dashed border-border/50 hover:border-primary/40 rounded-2xl p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-all duration-200 mb-6"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">إضافة عنوان جديد</span>
            </button>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-card rounded-2xl border border-border/60 p-5 mb-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground text-sm">عنوان جديد</p>
                  <button onClick={() => setShowNewForm(false)} className="text-muted-foreground hover:text-foreground text-xs">
                    إلغاء
                  </button>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">اسم العنوان (اختياري)</Label>
                  <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="مثال: البيت، العمل..." className="text-right" maxLength={50} />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                    <Phone className="w-3 h-3" /> رقم الهاتف <span className="text-destructive">*</span>
                  </Label>
                  <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xxxxxxxxx" dir="ltr" maxLength={20} />
                </div>

                <LocationSelect compact value={location} onChange={setLocation} disabled={submitting} className="sm:grid-cols-1" />

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block flex items-center gap-1">
                    <Landmark className="w-3 h-3" /> أقرب علامة دالة
                  </Label>
                  <Input value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="قرب مول المنصور" className="text-right" maxLength={200} />
                </div>

                {/* Save toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setSaveAddress(!saveAddress)}
                    className={cn(
                      'w-10 h-6 rounded-full transition-colors flex items-center px-1',
                      saveAddress ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <div className={cn('w-4 h-4 rounded-full bg-background shadow transition-transform', saveAddress ? 'translate-x-0' : '-translate-x-4')} />
                  </div>
                  <span className="text-sm text-foreground">حفظ هذا العنوان لطلبات مستقبلية</span>
                </label>

                <Button onClick={handleAddNew} disabled={submitting} className="w-full" size="sm">
                  <Plus className="w-4 h-4 ml-1" />
                  {submitting ? 'جاري الإضافة...' : 'إضافة العنوان'}
                </Button>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Confirm button */}
          {selectedAddr && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="bg-success/8 rounded-xl p-4 border border-success/20 text-sm text-foreground">
                <p className="font-medium text-success mb-1">سيتم التوصيل إلى:</p>
                <p className="text-foreground/80">{selectedAddr.province} — {selectedAddr.area}{selectedAddr.landmark ? ` — ${selectedAddr.landmark}` : ''}</p>
                <p className="text-foreground/80 mt-0.5" dir="ltr">{selectedAddr.phone}</p>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                size="lg"
                className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground"
              >
                <CheckCircle2 className="w-5 h-5 ml-2" />
                {submitting ? 'جاري التأكيد...' : 'تأكيد الموافقة وتحديد العنوان'}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="w-4 h-4 ml-1" /> رجوع
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DeliveryAddressPage;
