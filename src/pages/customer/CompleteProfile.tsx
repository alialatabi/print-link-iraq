import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, User, Landmark, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LocationSelect, { type LocationValue } from '@/components/LocationSelect';

const CompleteProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<LocationValue>({ provinceId: null, provinceName: '', areaId: null, areaName: '' });
  const [landmark, setLandmark] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        // Name intentionally starts empty so the customer types it fresh on this step.
        setPhone(data.phone || '');
        setLocation({
          provinceId: (data as { province_id?: number | null }).province_id ?? null,
          provinceName: data.province || '',
          areaId: (data as { area_id?: number | null }).area_id ?? null,
          areaName: data.area || '',
        });
        setLandmark(data.landmark || '');
        // If profile is already complete, redirect away
        if (data.province && data.area && data.landmark && data.display_name) {
          navigate(redirectTo, { replace: true });
          return;
        }
      }
      setLoading(false);
    };
    load();
  }, [user, navigate]);

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
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: trimmedName,
        phone: trimmedPhone,
        province: trimmedProvince,
        area: trimmedArea,
        province_id: location.provinceId,
        area_id: location.areaId,
        landmark: trimmedLandmark,
      } as never)
      .eq('user_id', user.id);

    setSaving(false);

    if (error) {
      toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'مرحباً بك! 🎉', description: 'تم حفظ بياناتك بنجاح' });
      navigate(redirectTo, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-20">
      <div className="container max-w-lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              أكمل بياناتك
            </h1>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed max-w-sm mx-auto">
              نحتاج عنوانك لتوصيل طلباتك بدقة. هذه الخطوة مطلوبة مرة واحدة فقط.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 p-6 sm:p-8 shadow-card">
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  الاسم الكامل <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="text-right"
                  maxLength={100}
                  required
                  autoFocus
                />
              </div>

              <div>
                <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  رقم الهاتف <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="tel"
                  value={phone}
                  readOnly
                  dir="ltr"
                  className="text-left bg-muted/50 text-muted-foreground cursor-not-allowed"
                  tabIndex={-1}
                  aria-readonly="true"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  هذا هو الرقم الذي سجّلت به. يمكنك تغييره لاحقاً من صفحة الملف الشخصي.
                </p>
              </div>

              <div className="space-y-4 border-t border-border/60 pt-5">
                <div className="flex items-center gap-2 text-foreground text-sm font-semibold">
                  <MapPin className="w-4 h-4 text-primary" />
                  العنوان التفصيلي
                </div>

                <LocationSelect value={location} onChange={setLocation} disabled={saving} className="sm:grid-cols-1" />

                <div>
                  <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                    <Landmark className="w-4 h-4 text-muted-foreground" />
                    أقرب علامة دالة <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={landmark}
                    onChange={e => setLandmark(e.target.value)}
                    placeholder="مثال: قرب مول المنصور"
                    className="text-right"
                    maxLength={200}
                    required
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-12 w-full text-base font-bold shadow-lg shadow-primary/20 transition-shadow disabled:shadow-none"
                  size="lg"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      حفظ والمتابعة
                      <ArrowLeft className="w-5 h-5 mr-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CompleteProfile;
