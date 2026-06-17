import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Lock, ArrowRight, Loader2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const StaffLogin = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { phoneLogin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      toast({ title: 'أدخل رقم الهاتف وكلمة المرور', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error, isNewUser } = await phoneLogin(phone, password);
    if (error) {
      toast({ title: 'خطأ في تسجيل الدخول', description: error.message, variant: 'destructive' });
    } else if (isNewUser) {
      toast({ title: 'تم إنشاء حسابك بنجاح!' });
      navigate('/complete-profile');
    } else {
      toast({ title: 'تم تسجيل الدخول بنجاح!' });
      // Send each staff member to their own area
      const { data: { user } } = await supabase.auth.getUser();
      let dest = '/';
      if (user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const list = (roles || []).map(r => r.role);
        if (list.includes('admin')) dest = '/admin';
        else if (list.includes('designer')) dest = '/designer/orders';
        else if (list.includes('reseller')) dest = '/reseller';
      }
      navigate(dest);
    }
    setSubmitting(false);
  };

  return (
    <div className="py-16 sm:py-24">
      <div className="container max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-7 sm:p-9 shadow-card border border-border/60"
        >
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              دخول الطاقم
            </h1>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              للمصممين والمشرفين فقط
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-foreground text-sm mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                رقم الهاتف
              </Label>
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="07xxxxxxxxx"
                dir="ltr"
                className="text-left text-lg tracking-wider"
                required
                autoFocus
              />
            </div>

            <div>
              <Label className="text-foreground text-sm mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                كلمة المرور
              </Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                dir="ltr"
                className="text-left"
                required
              />
            </div>

            <div className="pt-3">
              <Button type="submit" size="lg" disabled={submitting} className="w-full h-12 text-base">
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    دخول
                    <ArrowRight className="w-5 h-5 mr-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default StaffLogin;
