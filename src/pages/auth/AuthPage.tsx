import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { TrendingUp, Phone, ArrowRight, Loader2, Shield, RotateCcw, Timer, KeyRound, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { isNativeApp } from '@/lib/platform';
import { biometricEnabledForPhone, biometricRetrieve, disableBiometric } from '@/lib/biometric';

const RESEND_COOLDOWN = 60;

// phone → (route) → code login | otp verify → set/confirm PIN
type Step = 'phone' | 'code' | 'otp' | 'setpin';
type Mode = 'setup' | 'recovery';

const PinInput = ({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) => (
  <div dir="ltr">
    <InputOTP maxLength={6} value={value} onChange={onChange} autoFocus={autoFocus} containerClassName="w-full">
      <InputOTPGroup className="flex w-full gap-2 sm:gap-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <InputOTPSlot key={i} index={i} className="h-14 flex-1 !rounded-xl !border border-input bg-background/50 text-xl font-bold" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  </div>
);

const AuthPage = () => {
  const [step, setStep] = useState<Step>('phone');
  const [mode, setMode] = useState<Mode>('setup');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [bioForPhone, setBioForPhone] = useState(false); // entered phone is biometric-enrolled here
  const [showCodeEntry, setShowCodeEntry] = useState(false); // fall back to typing the PIN
  const [consent, setConsent] = useState(false); // explicit privacy/data consent (new accounts only)

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const { toast } = useToast();
  const { phoneLogin } = useAuth();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const goAfterAuth = (newUser: boolean) => {
    if (newUser) {
      navigate(redirectTo !== '/' ? `/complete-profile?redirect=${encodeURIComponent(redirectTo)}` : '/complete-profile');
    } else {
      navigate(redirectTo);
    }
  };

  // ── Step 1: phone → route to code login / OTP setup / staff page ──
  const submitPhone = async (force = false) => {
    if (!phone.trim() || phone.length < 10) {
      toast({ title: 'أدخل رقم هاتف صالح', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', { body: { phone, force } });
      if (error || data?.error) {
        toast({ title: 'خطأ', description: data?.error || error?.message || 'تعذّر المتابعة', variant: 'destructive' });
      } else if (data?.route === 'staff') {
        navigate('/staff-login');
        toast({ title: 'يرجى تسجيل الدخول بكلمة المرور' });
      } else if (data?.route === 'code') {
        // Registered: if this number has biometric enrolled on this device, offer fingerprint
        // instead of the PIN; otherwise show the PIN entry.
        const bio = await biometricEnabledForPhone(phone);
        setBioForPhone(bio); setShowCodeEntry(!bio); setPin(''); setStep('code');
      } else if (data?.route === 'otp') {
        setIsNewUser(!!data.isNewUser);
        setMode(force ? 'recovery' : 'setup');
        setOtp(''); setStep('otp'); setCountdown(RESEND_COOLDOWN);
        toast({ title: 'تم إرسال رمز التحقق إلى هاتفك' });
      }
    } catch {
      toast({ title: 'خطأ غير متوقع', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  // ── Step 2a: returning user signs in with their 6-digit code ──
  const submitCode = async () => {
    if (pin.length < 6) return;
    setSubmitting(true);
    const { error } = await phoneLogin(phone, pin);
    setSubmitting(false);
    if (error) {
      setPin('');
      toast({ title: 'خطأ', description: error.message || 'الرمز غير صحيح', variant: 'destructive' });
      return;
    }
    toast({ title: 'تم تسجيل الدخول بنجاح!' });
    goAfterAuth(false);
  };

  // ── Step 2b: verify the OTP (first-time or recovery) → then set a PIN ──
  const submitOtp = async () => {
    if (otp.length < 6) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', { body: { phone, code: otp } });
      if (error || data?.error) {
        toast({ title: 'خطأ', description: data?.error || error?.message || 'رمز غير صحيح', variant: 'destructive' });
        setOtp('');
      } else if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        setIsNewUser(!!data.isNewUser);
        // Recovery always resets the PIN; setup needs a PIN by definition.
        setPin(''); setConfirmPin(''); setStep('setpin');
      }
    } catch {
      toast({ title: 'خطأ غير متوقع', variant: 'destructive' });
    }
    setSubmitting(false);
  };

  // ── Step 3: choose / confirm the 6-digit code (becomes the account password) ──
  const submitSetPin = async () => {
    if (pin.length < 6) { toast({ title: 'أدخل رمزاً من 6 أرقام', variant: 'destructive' }); return; }
    if (pin !== confirmPin) { toast({ title: 'الرمزان غير متطابقين', variant: 'destructive' }); setConfirmPin(''); return; }
    if (mode === 'setup' && !consent) { toast({ title: 'يجب الموافقة على سياسة الخصوصية للمتابعة', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('set-pin', { body: { code: pin } });
      if (error || data?.error) {
        toast({ title: 'خطأ', description: data?.error || error?.message || 'تعذّر حفظ الرمز', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      toast({ title: mode === 'recovery' ? 'تم تحديث رمزك بنجاح' : 'تم إنشاء رمزك بنجاح' });
      goAfterAuth(isNewUser && mode === 'setup');
    } catch {
      toast({ title: 'خطأ غير متوقع', variant: 'destructive' });
      setSubmitting(false);
    }
  };

  // ── Skip PIN setup (setup mode only) ──
  // verify-otp already minted the session, so the customer is signed in even without a
  // PIN. Skippers just get an OTP again on their next login (send-otp routes accounts
  // without a PIN back to OTP), so this is safe with the deployed backend. Consent stays
  // mandatory — the exact same client-side gate that guards submitSetPin. Recovery mode
  // never offers skip: the user forgot their PIN and must set a working one.
  const skipPin = () => {
    if (mode === 'setup' && !consent) {
      toast({ title: 'يجب الموافقة على سياسة الخصوصية للمتابعة', variant: 'destructive' });
      return;
    }
    toast({ title: 'يمكنك ضبط رمزك لاحقاً من الملف الشخصي' });
    goAfterAuth(isNewUser && mode === 'setup');
  };

  const handleBiometric = async () => {
    setSubmitting(true);
    const cred = await biometricRetrieve();
    if (!cred) {
      // User cancelled / dismissed the OS dialog — stay on the fingerprint screen
      // so they can retry or switch to the code. No error toast, no auto-loop.
      setSubmitting(false);
      return;
    }
    const { error } = await phoneLogin(cred.phone, cred.pin);
    setSubmitting(false);
    if (error) {
      // Show the REAL reason. Only drop the stored credential when the account/PIN is
      // genuinely invalid (deleted/changed) — NOT on a transient lockout or network error,
      // which must never silently un-enroll the user's fingerprint.
      const msg = error.message || '';
      const invalid = msg.includes('الرمز غير صحيح') || msg.includes('غير صالح');
      if (invalid) {
        await disableBiometric();
        setBioForPhone(false);
        setShowCodeEntry(true);
      }
      toast({ title: 'تعذّر تسجيل الدخول بالبصمة', description: msg || 'سجّل الدخول بالرمز', variant: 'destructive' });
      return;
    }
    toast({ title: 'تم تسجيل الدخول بنجاح!' });
    navigate(redirectTo);
  };

  // Auto-open the OS fingerprint dialog once when we land on the fingerprint sub-screen.
  const autoPromptedRef = useRef(false);
  useEffect(() => {
    if (step === 'code' && bioForPhone && !showCodeEntry) {
      if (!autoPromptedRef.current) {
        autoPromptedRef.current = true;
        handleBiometric();
      }
    } else {
      autoPromptedRef.current = false; // reset when leaving the sub-screen
    }
    // handleBiometric is stable for this screen's purposes; deps intentionally limited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, bioForPhone, showCodeEntry]);

  const bioStep = step === 'code' && bioForPhone && !showCodeEntry;

  const headerIcon =
    bioStep ? <Fingerprint className="w-7 h-7 text-primary" />
    : step === 'phone' ? <TrendingUp className="w-7 h-7 text-primary" />
    : step === 'code' ? <KeyRound className="w-7 h-7 text-primary" />
    : step === 'setpin' ? <KeyRound className="w-7 h-7 text-primary" />
    : <Shield className="h-7 w-7 text-primary" />;

  return (
    <div className={isNativeApp ? 'pt-6 pb-10' : 'py-16 sm:py-24'}>
      <div className="container max-w-md">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-7 sm:p-9 shadow-card border border-border/60">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5">{headerIcon}</div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              {step === 'phone' ? 'تسجيل الدخول'
                : step === 'code' ? (bioStep ? 'تسجيل الدخول بالبصمة' : 'أدخل رمزك')
                : step === 'otp' ? 'التحقق من الرقم'
                : (mode === 'recovery' ? 'تعيين رمز جديد' : 'أنشئ رمز الدخول')}
            </h1>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              {step === 'phone' ? 'أدخل رقم هاتفك للدخول إلى حسابك'
                : step === 'code' ? (bioStep ? 'ضع إصبعك على المستشعر لتسجيل الدخول' : 'أدخل رمزك المكوّن من 6 أرقام')
                : step === 'otp' ? 'أدخل رمز التحقق المُرسَل إلى هاتفك'
                : 'اختر رمزاً من 6 أرقام تستخدمه لتسجيل الدخول'}
            </p>
            {(step === 'code' || step === 'otp' || step === 'setpin') && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3.5 py-1.5">
                <Phone className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-bold text-primary tabular-nums" dir="ltr">{phone}</span>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* ── PHONE ── */}
            {step === 'phone' && (
              <motion.div key="phone" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <form onSubmit={(e) => { e.preventDefault(); submitPhone(); }} className="space-y-5">
                  <div>
                    <Label className="text-foreground text-sm mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" /> رقم الهاتف
                    </Label>
                    <Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xxxxxxxxx" dir="ltr" className="text-left text-lg tracking-wider" required autoFocus />
                  </div>
                  <Button type="submit" size="lg" disabled={submitting} className="w-full h-12 text-base">
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>متابعة<ArrowRight className="w-5 h-5 mr-2" /></>}
                  </Button>
                </form>

                <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
                  بالمتابعة، أنت توافق على{' '}
                  <Link to="/privacy" className="text-primary font-medium hover:underline">سياسة الخصوصية</Link>
                </p>
              </motion.div>
            )}

            {/* ── CODE LOGIN ── */}
            {step === 'code' && (
              <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                {bioStep ? (
                  <div className="space-y-5 text-center">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      ضع إصبعك على المستشعر لتسجيل الدخول، أو استخدم رمزك.
                    </p>
                    <Button onClick={handleBiometric} disabled={submitting} size="lg" className="h-12 w-full text-base font-bold gap-2">
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Fingerprint className="h-5 w-5" /> تسجيل الدخول بالبصمة</>}
                    </Button>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep('phone'); setPin(''); }}>
                        <ArrowRight className="ml-1 h-4 w-4" /> تغيير الرقم
                      </Button>
                      <span className="h-4 w-px bg-border" aria-hidden />
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => { setShowCodeEntry(true); setPin(''); }}>
                        استخدم الرمز
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-6"><PinInput value={pin} onChange={setPin} autoFocus /></div>
                    <div className="space-y-4">
                      <Button onClick={submitCode} disabled={pin.length < 6 || submitting} size="lg" className="h-12 w-full text-base font-bold">
                        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'دخول'}
                      </Button>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep('phone'); setPin(''); }}>
                          <ArrowRight className="ml-1 h-4 w-4" /> تغيير الرقم
                        </Button>
                        <span className="h-4 w-px bg-border" aria-hidden />
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => submitPhone(true)} disabled={submitting}>
                          نسيت الرمز؟
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* ── OTP VERIFY ── */}
            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="mb-6"><PinInput value={otp} onChange={setOtp} autoFocus /></div>
                {countdown > 0 && (
                  <div className="mb-6">
                    <div className="mb-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                      <Timer className="h-3.5 w-3.5 text-primary" />
                      <span>يمكنك إعادة الإرسال خلال</span>
                      <span className="font-bold text-primary tabular-nums" dir="ltr">{countdown}</span>
                      <span>ثانية</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div className="h-full rounded-full bg-primary" initial={false} animate={{ width: `${(countdown / RESEND_COOLDOWN) * 100}%` }} transition={{ ease: 'linear', duration: 1 }} />
                    </div>
                  </div>
                )}
                <div className="space-y-4">
                  <Button onClick={submitOtp} disabled={otp.length < 6 || submitting} size="lg" className="h-12 w-full text-base font-bold">
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تأكيد'}
                  </Button>
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep('phone'); setOtp(''); setCountdown(0); }}>
                      <ArrowRight className="ml-1 h-4 w-4" /> تغيير الرقم
                    </Button>
                    <span className="h-4 w-px bg-border" aria-hidden />
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground disabled:opacity-50" onClick={async () => { setResending(true); await submitPhone(mode === 'recovery'); setResending(false); }} disabled={resending || countdown > 0}>
                      {resending ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <RotateCcw className="ml-1 h-4 w-4" />} إعادة الإرسال
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── SET / CONFIRM PIN ── */}
            {step === 'setpin' && (
              <motion.div key="setpin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="space-y-5">
                  <div>
                    <Label className="text-foreground text-sm mb-2 block">الرمز الجديد</Label>
                    <PinInput value={pin} onChange={setPin} autoFocus />
                  </div>
                  <div>
                    <Label className="text-foreground text-sm mb-2 block">تأكيد الرمز</Label>
                    <PinInput value={confirmPin} onChange={setConfirmPin} />
                  </div>
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
                    🔒 ستستخدم هذا الرمز لتسجيل الدخول لاحقاً. تجنّب الأرقام السهلة مثل 123456.
                  </p>
                  {mode === 'setup' && (
                    <div className="flex items-start gap-2.5">
                      <Checkbox id="consent" checked={consent} onCheckedChange={v => setConsent(v === true)} className="mt-0.5 shrink-0" />
                      <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed font-normal cursor-pointer">
                        أوافق على{' '}
                        <Link to="/privacy" target="_blank" onClick={e => e.stopPropagation()} className="text-primary font-medium hover:underline">سياسة الخصوصية</Link>
                        ، وعلى احتفاظ "مطبعتي" بعنواني ورقم هاتفي وتاريخ طلباتي، وحفظ تصاميمي والمعلومات الواردة فيها ونشرها واستخدامها، واستخدام صوري ومعلوماتي وتصاميمي لتدريب نماذج الذكاء الاصطناعي مستقبلاً.
                      </Label>
                    </div>
                  )}
                  <Button onClick={submitSetPin} disabled={pin.length < 6 || confirmPin.length < 6 || submitting || (mode === 'setup' && !consent)} size="lg" className="h-12 w-full text-base font-bold">
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'حفظ ومتابعة'}
                  </Button>
                  {mode === 'setup' && (
                    <div className="pt-1 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={skipPin}
                        disabled={submitting || !consent}
                        className="h-auto whitespace-normal py-2 text-sm font-medium leading-relaxed text-muted-foreground hover:text-foreground"
                      >
                        تخطي الآن — يمكنك ضبط الرمز لاحقاً من الملف الشخصي
                      </Button>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
                        بدون رمز، سنرسل لك رمز تحقق عبر الرسائل عند تسجيل الدخول القادم.
                      </p>
                    </div>
                  )}
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
