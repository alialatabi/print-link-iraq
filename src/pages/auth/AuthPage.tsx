import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, Phone, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AuthPage = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { phoneLogin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.length < 10) {
      toast({ title: 'أدخل رقم هاتف صالح', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error, isNewUser } = await phoneLogin(phone, password || undefined);
    if (error) {
      toast({ title: 'خطأ في تسجيل الدخول', description: error.message, variant: 'destructive' });
    } else if (isNewUser) {
      toast({ title: 'تم إنشاء حسابك بنجاح!' });
      navigate('/complete-profile');
    } else {
      toast({ title: 'تم تسجيل الدخول بنجاح!' });
      navigate('/');
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
              <TrendingUp className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              تسجيل الدخول
            </h1>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              أدخل رقم هاتفك للدخول أو إنشاء حساب جديد
            </p>
          </div>

          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleLogin}
            className="space-y-5"
          >
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
                كلمة المرور <span className="text-muted-foreground">(اختياري)</span>
              </Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="للمشرفين فقط"
                dir="ltr"
                className="text-left"
              />
            </div>

            <div className="pt-3">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full h-12 text-base"
              >
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
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
