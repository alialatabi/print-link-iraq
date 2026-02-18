import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, Mail, Lock, User, LogIn, UserPlus, Phone, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: 'خطأ في تسجيل الدخول', description: error.message, variant: 'destructive' });
      } else {
        navigate('/');
      }
    } else {
      if (!phone.trim()) {
        toast({ title: 'رقم الهاتف مطلوب', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      const { error } = await signUp(email, password, displayName, phone, address);
      if (error) {
        toast({ title: 'خطأ في إنشاء الحساب', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'تم إنشاء الحساب', description: 'تحقق من بريدك الإلكتروني لتأكيد الحساب' });
      }
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
              {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </h1>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              {isLogin ? 'أدخل بياناتك لتسجيل الدخول' : 'أنشئ حسابك للبدء'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div>
                  <Label className="text-foreground text-sm mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    الاسم الكامل
                  </Label>
                  <Input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    required={!isLogin}
                  />
                </div>

                <div>
                  <Label className="text-foreground text-sm mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    رقم الهاتف <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="07xxxxxxxxx"
                    dir="ltr"
                    className="text-left"
                    required={!isLogin}
                  />
                </div>

                <div>
                  <Label className="text-foreground text-sm mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    العنوان
                  </Label>
                  <Input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="المحافظة - المنطقة - أقرب نقطة دالة"
                  />
                </div>
              </>
            )}

            <div>
              <Label className="text-foreground text-sm mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                البريد الإلكتروني
              </Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@mail.com"
                dir="ltr"
                className="text-left"
                required
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
                placeholder="••••••••"
                required
                minLength={6}
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
                  'جاري التحميل...'
                ) : isLogin ? (
                  <>
                    <LogIn className="w-5 h-5 ml-2" />
                    تسجيل الدخول
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 ml-2" />
                    إنشاء حساب
                  </>
                )}
              </Button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline text-sm font-medium transition-colors duration-150"
            >
              {isLogin ? 'ليس لديك حساب؟ أنشئ حساباً جديداً' : 'لديك حساب بالفعل؟ سجل الدخول'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
