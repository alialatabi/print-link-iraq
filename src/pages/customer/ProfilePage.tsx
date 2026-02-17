import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Phone, MapPin, Save, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ProfilePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name || '');
        setPhone(data.phone || '');
        setAddress(data.address || '');
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      toast({ title: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: trimmedName,
        phone: phone.trim() || null,
        address: address.trim() || null,
      })
      .eq('user_id', user.id);

    setSaving(false);

    if (error) {
      toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'تم الحفظ بنجاح',
        description: 'تم تحديث بياناتك الشخصية',
      });
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
    <div className="py-12">
      <div className="container max-w-lg">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">الملف الشخصي</h1>
              <p className="text-muted-foreground text-sm">عدّل بياناتك الشخصية</p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  الاسم <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="اسمك الكامل"
                  className="text-right"
                  maxLength={100}
                  required
                />
              </div>

              <div>
                <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  رقم الهاتف
                </Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0770 123 4567"
                  className="text-right"
                  maxLength={20}
                />
              </div>

              <div>
                <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  العنوان
                </Label>
                <Input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="بغداد - الكرادة"
                  className="text-right"
                  maxLength={200}
                />
              </div>

              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-4">
                  البريد: {user?.email || '—'}
                </p>
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl"
                  size="lg"
                >
                  {saving ? (
                    <>جاري الحفظ...</>
                  ) : (
                    <>
                      <Save className="w-4 h-4 ml-2" />
                      حفظ التعديلات
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

export default ProfilePage;
