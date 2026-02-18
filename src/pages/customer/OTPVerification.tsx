import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Phone, Shield } from 'lucide-react';

const OTPVerification = () => {
  const [otp, setOtp] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order');
  const { updateOrderStatus } = useApp();

  const handleVerify = () => {
    if (otp.length === 4) {
      if (orderId) updateOrderStatus(orderId, 'submitted');
      navigate(`/order-success?order=${orderId}`);
    }
  };

  return (
    <div className="py-20">
      <div className="container max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">التحقق من رقم الهاتف</h1>
          <p className="text-muted-foreground mb-8">
            أدخل رمز التحقق المرسل إلى هاتفك
          </p>

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

          <p className="text-muted-foreground text-sm mb-6">
            <Phone className="w-4 h-4 inline-block ml-1" />
            أدخل الرمز المرسل عبر واتساب
          </p>

          <Button
            onClick={handleVerify}
            disabled={otp.length < 6}
            size="lg"
            className="w-full bg-success hover:bg-success/90 text-success-foreground text-lg py-6 rounded-xl"
          >
            تأكيد
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default OTPVerification;
