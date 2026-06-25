import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Phone, Shield, Timer, RotateCcw, Loader2 } from 'lucide-react';

const RESEND_COOLDOWN = 60;

const OTPVerification = () => {
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');
  const { updateOrderStatus } = useApp();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = () => {
    if (otp.length === 4) {
      if (orderId) updateOrderStatus(orderId, 'submitted');
      navigate(`/order-success?order=${orderId}`);
    }
  };

  const handleResend = () => {
    setResending(true);
    setTimeout(() => {
      setResending(false);
      setCountdown(RESEND_COOLDOWN);
    }, 1500);
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

            <h1 className="text-2xl font-extrabold text-foreground tracking-tight mb-2">التحقق من رقم الهاتف</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              أدخل رمز التحقق المرسل إلى هاتفك
            </p>
          </div>

          {/* Countdown Timer */}
          {countdown > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 mb-5 py-2.5 px-4 rounded-xl bg-muted/60 border border-border/60"
            >
              <Timer className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">يمكنك إعادة الإرسال بعد</span>
              <span className="text-sm font-bold text-primary tabular-nums min-w-[2ch] text-center" dir="ltr">
                {countdown}
              </span>
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

          <p className="text-muted-foreground text-sm mb-6 text-center">
            <Phone className="w-4 h-4 inline-block ml-1" />
            أدخل الرمز المرسل إلى هاتفك
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleVerify}
              disabled={otp.length < 6}
              size="lg"
              className="w-full h-12 text-base"
            >
              تأكيد
            </Button>

            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resending || countdown > 0}
              >
                {resending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 ml-1" />
                )}
                {countdown > 0 ? `${countdown}` : 'إعادة الإرسال'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default OTPVerification;
