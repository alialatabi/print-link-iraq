import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, FileText, Image, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import { useServices } from '@/hooks/useServices';

type Step = 'upload' | 'service';

const ACCEPTED = '.png,.jpg,.jpeg,.pdf,.psd';

const UploadDesignPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { services, loading: servicesLoading } = useServices();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const allowed = ['png', 'jpg', 'jpeg', 'pdf', 'psd'];
    if (!allowed.includes(ext)) {
      toast({ title: 'نوع الملف غير مسموح', description: 'يُرجى رفع PNG, JPEG, PDF أو PSD فقط', variant: 'destructive' });
      return;
    }
    if (f.size > 30 * 1024 * 1024) {
      toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 30MB', variant: 'destructive' });
      return;
    }
    setFile(f);
    if (['png', 'jpg', 'jpeg'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = ev => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      const fakeEvent = { target: { files: [f] } } as any;
      handleFileSelect(fakeEvent);
    }
  };

  const handleSubmit = async () => {
    if (!file || !selectedService || !user) return;
    setSubmitting(true);

    try {
      // 1. Create the order first
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          status: 'submitted' as any,
          customer_name: user.id,
          customer_phone: '-',
          details: {
            order_type: 'ready_design',
            service_type: selectedService,
            attachment_urls: [],
          } as any,
        })
        .select('id')
        .single();

      if (orderError || !orderData) throw orderError;

      // 2. Upload the design file to order-attachments
      const ext = file.name.split('.').pop();
      const path = `${orderData.id}/ready_design.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('order-attachments')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(path);

      // 3. Update order with file URL and service type
      await supabase.from('orders').update({
        details: {
          order_type: 'ready_design',
          service_type: selectedService,
          attachment_urls: [publicUrl],
        } as any,
      }).eq('id', orderData.id);

      toast({ title: 'تم إرسال طلبك بنجاح ✅' });
      navigate(`/order-success?order=${orderData.id}`);
    } catch (err: any) {
      toast({ title: 'حدث خطأ', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = step === 'upload' ? !!file : !!selectedService;

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-2xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-semibold mb-4">
            <Upload className="w-3.5 h-3.5" />
            تصميم جاهز للطباعة
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">ارفع تصميمك الجاهز</h1>
          <p className="text-muted-foreground text-sm">ارفع ملف تصميمك وسيراجعه المصمم قبل الطباعة</p>
        </motion.div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {(['upload', 'service'] as Step[]).map((s, i) => {
            const isActive = s === step;
            const isDone = (step === 'service' && s === 'upload');
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isDone ? 'bg-success text-success-foreground' :
                  isActive ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s === 'upload' ? 'رفع الملف' : 'نوع الخدمة'}
                </span>
                {i === 0 && <ChevronLeft className="w-4 h-4 text-muted-foreground/40" />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Upload file */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                onChange={handleFileSelect}
                className="hidden"
              />

              {!file ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-12 text-center cursor-pointer transition-all hover:bg-primary/3 group"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="font-bold text-foreground text-base mb-1">اسحب الملف هنا أو اضغط للاختيار</p>
                  <p className="text-muted-foreground text-sm">PNG, JPEG, PDF, PSD — حتى 30MB</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-card rounded-2xl border border-border overflow-hidden"
                >
                  {preview ? (
                    <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
                      <img src={preview} alt="معاينة" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="p-8 flex items-center justify-center">
                      <div className="text-center">
                        <FileText className="w-14 h-14 text-primary mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">{file.name.split('.').pop()?.toUpperCase()}</p>
                      </div>
                    </div>
                  )}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground truncate max-w-[180px]">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setFile(null); setPreview(null); }}
                      className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {file && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary underline underline-offset-2 w-full text-center"
                >
                  تغيير الملف
                </button>
              )}
            </motion.div>
          )}

          {/* Step 2: Select service */}
          {step === 'service' && (
            <motion.div
              key="service"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Label className="text-foreground font-semibold text-base block mb-4">اختر نوع الطباعة المطلوبة</Label>
              {servicesLoading ? (
                <div className="text-center py-12 text-muted-foreground text-sm">جاري تحميل الخدمات...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {services.map(service => (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service.id)}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${
                        selectedService === service.id
                          ? 'border-primary bg-primary/8 text-primary'
                          : 'border-border bg-card hover:border-primary/30'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2 overflow-hidden">
                        {service.icon_url ? (
                          <img src={service.icon_url} alt={service.label} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{service.icon}</span>
                        )}
                      </div>
                      <p className="text-xs font-semibold">{service.label}</p>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step === 'service' && (
            <Button
              variant="outline"
              onClick={() => setStep('upload')}
              className="flex-1"
              disabled={submitting}
            >
              <ChevronRight className="w-4 h-4 ml-1" />
              السابق
            </Button>
          )}
          {step === 'upload' ? (
            <Button
              onClick={() => setStep('service')}
              disabled={!canProceed}
              size="lg"
              className="w-full"
            >
              التالي
              <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceed || submitting}
              size="lg"
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 ml-2 animate-spin" />جاري الإرسال...</>
              ) : (
                'إرسال الطلب ✅'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadDesignPage;
