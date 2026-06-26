import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Phone, Shield, ArrowRight, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const RESEND_COOLDOWN = 60;

/** Normalize like the edge functions: strip spaces, map a leading 0 to the Iraq code. */
const normalize = (p: string) => p.replace(/\s+/g, '').replace(/^0/, '964');

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The customer's current (normalized) phone, for display + same-number guard. */
  currentPhone: string;
  /** Called with the new normalized phone once the change is verified and saved. */
  onChanged: (newPhone: string) => void;
}

type Step = 'enter' | 'verify';

const ChangePhoneDialog = ({ open, onOpenChange, currentPhone, onChanged }: Props) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('enter');
  const [newPhone, setNewPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Reset everything whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setStep('enter');
      setNewPhone('');
      setOtp('');
      setCountdown(0);
    }
  }, [open]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const sendCode = async () => {
    const trimmed = newPhone.trim();
    if (trimmed.length < 10) {
      toast({ title: 'أدخل رقم هاتف صالح', variant: 'destructive' });
      return;
    }
    if (normalize(trimmed) === currentPhone) {
      toast({ title: 'هذا هو رقمك الحالي', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', { body: { phone: trimmed } });
      if (error || data?.error) {
        toast({ title: 'خطأ', description: data?.error || error?.message || 'فشل إرسال الرمز', variant: 'destructive' });
      } else if (data?.route === 'otp' && data?.isNewUser) {
        // Only a brand-new (unclaimed) number gets an OTP and can be switched to.
        toast({ title: 'تم إرسال رمز التحقق إلى الرقم الجديد' });
        setOtp('');
        setStep('verify');
        setCountdown(RESEND_COOLDOWN);
      } else {
        // staff number, or an existing account (route 'staff'/'code', or 'otp' on a known profile).
        toast({ title: 'هذا الرقم مستخدم بالفعل بحساب آخر', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ غير متوقع', variant: 'destructive' });
    }
    setSending(false);
  };

  const verify = async () => {
    if (otp.length < 6) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-phone', {
        body: { newPhone: newPhone.trim(), code: otp },
      });
      if (error || data?.error) {
        toast({ title: 'خطأ', description: data?.error || error?.message || 'رمز غير صحيح', variant: 'destructive' });
      } else {
        if (data?.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }
        onChanged(data?.phone || normalize(newPhone.trim()));
        toast({ title: 'تم تغيير رقم الهاتف بنجاح 🎉' });
        onOpenChange(false);
      }
    } catch {
      toast({ title: 'خطأ غير متوقع', variant: 'destructive' });
    }
    setVerifying(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">تغيير رقم الهاتف</DialogTitle>
          <DialogDescription>
            {step === 'enter'
              ? 'أدخل رقمك الجديد وسنرسل لك رمز تحقق لتأكيده.'
              : 'أدخل الرمز المكوّن من 6 أرقام المُرسَل إلى رقمك الجديد.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'enter' ? (
          <div className="space-y-4 pt-1">
            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                الرقم الجديد
              </Label>
              <Input
                type="tel"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="07xxxxxxxxx"
                dir="ltr"
                className="text-left text-lg tracking-wider"
                maxLength={20}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') sendCode(); }}
              />
            </div>
            <Button onClick={sendCode} disabled={sending} size="lg" className="h-12 w-full text-base font-bold">
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'إرسال رمز التحقق'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <div className="text-center text-sm font-bold text-primary" dir="ltr">
              {normalize(newPhone.trim())}
            </div>

            <div dir="ltr">
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

            <Button onClick={verify} disabled={otp.length < 6 || verifying} size="lg" className="h-12 w-full text-base font-bold">
              {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : 'تأكيد التغيير'}
            </Button>

            <div className="flex items-center justify-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => { setStep('enter'); setOtp(''); setCountdown(0); }}
              >
                <ArrowRight className="ml-1 h-4 w-4" />
                تغيير الرقم
              </Button>
              <span className="h-4 w-px bg-border" aria-hidden />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                onClick={sendCode}
                disabled={sending || countdown > 0}
              >
                {sending ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <RotateCcw className="ml-1 h-4 w-4" />}
                {countdown > 0 ? `إعادة الإرسال (${countdown})` : 'إعادة الإرسال'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChangePhoneDialog;
