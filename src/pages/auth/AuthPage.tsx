import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { TrendingUp, Phone, Shield, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Step = 'phone' | 'otp' | 'profile';

const AuthPage = () => {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || phone.length < 10) {
      toast({ title: 'أدخل رقم هاتف صالح', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await sendOtp(phone);
    if (error) {
      toast({ title: 'خطأ في إرسال الرمز', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم إرسال رمز التحقق', description: 'تحقق من رسائل الواتساب' });
      setStep('otp');
    }
    setSubmitting(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return;
    setSubmitting(true);
    const { error, isNewUser } = await verifyOtp(phone, otp);
    if (error) {
      toast({ title: 'رمز التحقق غير صحيح', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: isNewUser ? 'تم إنشاء حسابك بنجاح!' : 'تم تسجيل الدخول بنجاح!' });
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
              {step === 'phone' ? (
                <TrendingUp className="w-7 h-7 text-primary" />
              ) : (
                <Shield className="w-7 h-7 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              {step === 'phone' ? 'تسجيل الدخول' : 'التحقق من الرقم'}
            </h1>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              {step === 'phone'
                ? 'أدخل رقم هاتفك وسنرسل لك رمز تحقق عبر الواتساب'
                : 'أدخل رمز التحقق المرسل إلى واتساب'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 'phone' && (
              <motion.form
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSendOtp}
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
                  <p className="text-xs text-muted-foreground mt-2">
                    سنرسل رمز تحقق مكون من 6 أرقام عبر الواتساب
                  </p>
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
                        إرسال رمز التحقق
                        <ArrowRight className="w-5 h-5 mr-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.form>
            )}

            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-center" dir="ltr">
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

                <p className="text-muted-foreground text-sm text-center">
                  تم الإرسال إلى <span className="font-mono text-foreground" dir="ltr">{phone}</span>
                </p>

                <div className="space-y-3 pt-2">
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={otp.length < 6 || submitting}
                    size="lg"
                    className="w-full h-12 text-base"
                  >
                    {submitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'تأكيد'
                    )}
                  </Button>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => { setStep('phone'); setOtp(''); }}
                      className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      تغيير الرقم
                    </button>
                    <button
                      onClick={async () => {
                        setSubmitting(true);
                        await sendOtp(phone);
                        toast({ title: 'تم إعادة إرسال الرمز' });
                        setSubmitting(false);
                      }}
                      disabled={submitting}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      إعادة الإرسال
                    </button>
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
