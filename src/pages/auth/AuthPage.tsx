import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { TrendingUp, Phone, ArrowRight, Loader2, Shield, RotateCcw, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const RESEND_COOLDOWN = 60;

type Step = 'phone' | 'otp';

const AuthPage = () => {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const { toast } = useToast();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const sendOtp = async () => {
    if (!phone.trim() || phone.length < 10) {
      toast({ title: 'أدخل رقم هاتف صالح', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone },
      });
      if (error || data?.error) {
        toast({ title: 'خطأ', description: data?.error || error?.message || 'فشل إرسال الرمز', variant: 'destructive' });
      } else if (data?.existingUser && data?.isStaff) {
        // Staff member — redirect to staff login page
        navigate('/staff-login');
        toast({ title: 'يرجى تسجيل الدخول بكلمة المرور' });
      } else if (data?.existingUser && data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast({ title: 'تم تسجيل الدخول بنجاح!' });
        navigate(redirectTo);
      } else {
        toast({ title: 'تم إرسال رمز التحقق عبر واتساب' });
        setStep('otp');
        setCountdown(RESEND_COOLDOWN);
      }
    } catch {
      toast({ title: 'خطأ غير متوقع', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleResend = async () => {
    setResending(true);
    await sendOtp();
    setResending(false);
  };

  const verifyOtp = async () => {
    if (otp.length < 6) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, code: otp },
      });
      if (error || data?.error) {
        toast({ title: 'خطأ', description: data?.error || error?.message || 'رمز غير صحيح', variant: 'destructive' });
      } else if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (data.isNewUser) {
          toast({ title: 'تم إنشاء حسابك بنجاح!' });
          const completeProfileUrl = redirectTo !== '/'
            ? `/complete-profile?redirect=${encodeURIComponent(redirectTo)}`
            : '/complete-profile';
          navigate(completeProfileUrl);
        } else {
          toast({ title: 'تم تسجيل الدخول بنجاح!' });
          navigate(redirectTo);
        }
      }
    } catch {
      toast({ title: 'خطأ غير متوقع', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp();
  };

  return (
    <div className="py-16 sm:py-24">
      <div className="container max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-7 sm:p-9 shadow-card border border-border/60"
        >
          <AnimatePresence mode="wait">
            {step === 'phone' ? (
              <motion.div key="phone" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5">
                    <TrendingUp className="w-7 h-7 text-primary" />
                  </div>
                  <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                    تسجيل الدخول
                  </h1>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    أدخل رقم هاتفك للدخول إلى حسابك
                  </p>
                </div>

                <form onSubmit={handlePhoneSubmit} className="space-y-5">
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

                  <div className="pt-3">
                    <Button type="submit" size="lg" disabled={submitting} className="w-full h-12 text-base">
                      {submitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          تسجيل الدخول
                          <ArrowRight className="w-5 h-5 mr-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5">
                    <Shield className="w-7 h-7 text-primary" />
                  </div>
                  <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                    التحقق من الرقم
                  </h1>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    أدخل الرمز المكون من 6 أرقام المرسل إلى واتساب
                  </p>
                  <p className="text-primary text-sm mt-1 font-medium" dir="ltr">{phone}</p>
                </div>

                {countdown > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 mb-5 py-2.5 px-4 rounded-xl bg-muted/60 border border-border/60"
                  >
                    <Timer className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">يمكنك إعادة الإرسال بعد</span>
                    <span className="text-sm font-bold text-primary tabular-nums min-w-[2ch] text-center" dir="ltr">{countdown}</span>
                    <span className="text-sm text-muted-foreground">ثانية</span>
                  </motion.div>
                )}

                <div className="flex justify-center mb-6" dir="ltr">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="space-y-3">
                  <Button onClick={verifyOtp} disabled={otp.length < 6 || submitting} size="lg" className="w-full h-12 text-base">
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد'}
                  </Button>
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => { setStep('phone'); setOtp(''); setCountdown(0); }}>
                      <ArrowRight className="w-4 h-4 ml-1" />
                      تغيير الرقم
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleResend} disabled={resending || countdown > 0}>
                      {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4 ml-1" />}
                      {countdown > 0 ? `${countdown}` : 'إعادة الإرسال'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default AuthPage;
