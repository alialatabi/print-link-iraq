import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, Mail, Lock, User, LogIn, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
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
      const { error } = await signUp(email, password, displayName);
      if (error) {
        toast({ title: 'خطأ في إنشاء الحساب', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'تم إنشاء الحساب', description: 'تحقق من بريدك الإلكتروني لتأكيد الحساب' });
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="py-16">
      <div className="container max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-8 shadow-card border border-border"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
              <Printer className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isLogin ? 'أدخل بياناتك لتسجيل الدخول' : 'أنشئ حسابك للبدء'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <Label className="text-foreground mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  الاسم
                </Label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="أدخل اسمك"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <Label className="text-foreground mb-2 flex items-center gap-2">
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
              <Label className="text-foreground mb-2 flex items-center gap-2">
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

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg py-6 rounded-xl"
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
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline text-sm font-medium"
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
