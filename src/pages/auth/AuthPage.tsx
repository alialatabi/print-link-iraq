import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
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
        toast({ title: 'خطأ', description: data?.error || error?.message || 'فشل تسجيل الدخول', variant: 'destructive' });
      } else if (data?.existingUser && data?.isStaff) {
        // Staff member — redirect to staff login page (password, not OTP).
        navigate('/staff-login');
        toast({ title: 'يرجى تسجيل الدخول بكلمة المرور' });
      } else if (data?.session) {
        // Within the OTP validity window (3 weeks since the customer's last OTP) send-otp returns a
        // session directly — auto-login with no code. Outside the window it sends an OTP and we fall
        // through to the OTP step instead.
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (data?.isNewUser) {
          toast({ title: 'تم إنشاء حسابك بنجاح!' });
          const completeProfileUrl = redirectTo !== '/'
            ? `/complete-profile?redirect=${encodeURIComponent(redirectTo)}`
            : '/complete-profile';
          navigate(completeProfileUrl);
        } else {
          toast({ title: 'تم تسجيل الدخول بنجاح!' });
          navigate(redirectTo);
        }
      } else {
        // Customer (new or returning): a 6-digit code was sent via OTPIQ (SMS/WhatsApp,
        // channel chosen automatically) — keep the message channel-neutral.
        toast({ title: 'تم إرسال رمز التحقق إلى هاتفك' });
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

                <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
                  بالمتابعة، أنت توافق على{' '}
                  <Link to="/privacy" className="text-primary font-medium hover:underline">
                    سياسة الخصوصية
                  </Link>
                </p>
              </motion.div>
            ) : (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="text-center mb-7">
                  <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-2xl bg-primary/10"
                      animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0, 0.55] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15">
                      <Shield className="h-7 w-7 text-primary" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
                    التحقق من الرقم
                  </h1>
                  <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                    أدخل الرمز المكوّن من 6 أرقام المُرسَل إلى هاتفك
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3.5 py-1.5">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-bold text-primary tabular-nums" dir="ltr">{phone}</span>
                  </div>
                </div>

                <div className="mb-6" dir="ltr">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="w-full">
                    <InputOTPGroup className="flex w-full gap-2 sm:gap-3">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-14 flex-1 !rounded-xl !border border-input bg-background/50 text-xl font-bold"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {countdown > 0 && (
                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                      <Timer className="h-3.5 w-3.5 text-primary" />
                      <span>يمكنك إعادة الإرسال خلال</span>
                      <span className="font-bold text-primary tabular-nums" dir="ltr">{countdown}</span>
                      <span>ثانية</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={false}
                        animate={{ width: `${(countdown / RESEND_COOLDOWN) * 100}%` }}
                        transition={{ ease: 'linear', duration: 1 }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Button
                    onClick={verifyOtp}
                    disabled={otp.length < 6 || submitting}
                    size="lg"
                    className="h-12 w-full text-base font-bold shadow-lg shadow-primary/20 transition-shadow disabled:shadow-none"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تأكيد'}
                  </Button>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => { setStep('phone'); setOtp(''); setCountdown(0); }}
                    >
                      <ArrowRight className="ml-1 h-4 w-4" />
                      تغيير الرقم
                    </Button>
                    <span className="h-4 w-px bg-border" aria-hidden />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                      onClick={handleResend}
                      disabled={resending || countdown > 0}
                    >
                      {resending ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <RotateCcw className="ml-1 h-4 w-4" />}
                      إعادة الإرسال
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
