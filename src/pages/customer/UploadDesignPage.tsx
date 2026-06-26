import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, FileText, Loader2, CheckCircle2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import { useServices } from '@/hooks/useServices';
import { buildCatalog, buildPricingSnapshot } from '@/lib/orderPricing';
import { isNativeApp } from '@/lib/platform';
import {
  insertOrder,
  uploadOrderAttachment,
  getOrderAttachmentPublicUrl,
  patchOrderDetails,
} from '@/services/orders';
import type { Json } from '@/integrations/supabase/types';

type Step = 'service' | 'upload';

const ACCEPTED = '.png,.jpg,.jpeg,.pdf,.psd';
const ALLOWED_EXTS = ['png', 'jpg', 'jpeg', 'pdf', 'psd'];

interface FileSlot {
  file: File;
  preview: string | null;
}

const validateFile = (f: File): string | null => {
  const ext = f.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTS.includes(ext)) return 'نوع الملف غير مسموح — يُرجى رفع PNG, JPEG, PDF أو PSD فقط';
  if (f.size > 30 * 1024 * 1024) return 'الملف كبير جداً — الحد الأقصى 30MB';
  return null;
};

const toFileSlot = (f: File): Promise<FileSlot> =>
  new Promise(resolve => {
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = ev => resolve({ file: f, preview: ev.target?.result as string });
      reader.readAsDataURL(f);
    } else {
      resolve({ file: f, preview: null });
    }
  });

/** Interactive drag & drop zone */
const DropZone = ({ onDrop, onClick }: { onDrop: (e: React.DragEvent) => void; onClick: () => void }) => {
  const [dragging, setDragging] = useState(false);
  return (
    <motion.div
      onDrop={(e) => { setDragging(false); onDrop(e); }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 group ${
        dragging
          ? 'border-primary bg-primary/5 scale-[1.02]'
          : 'border-border/60 hover:border-primary/40 hover:bg-primary/3'
      }`}
    >
      <motion.div
        className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/10 transition-colors duration-300"
        animate={dragging ? { scale: 1.15, rotate: -5 } : { scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <Upload className={`w-7 h-7 transition-colors duration-300 ${dragging ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
      </motion.div>
      <p className="font-bold text-foreground text-sm mb-1">
        {dragging ? 'أفلت الملف هنا' : 'اسحب الملف هنا أو اضغط للاختيار'}
      </p>
      <p className="text-muted-foreground text-xs">PNG, JPEG, PDF, PSD — حتى 30MB</p>
      {dragging && (
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-primary/30 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </motion.div>
  );
};

/** Mini file card used for both slots */
const FileCard = ({ slot, onRemove, onReplace, inputRef: _inputRef }: {
  slot: FileSlot;
  onRemove: () => void;
  onReplace: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) => (
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-2xl border border-border overflow-hidden">
    {slot.preview ? (
      <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden">
        <img src={slot.preview} alt="معاينة" className="w-full h-full object-contain" />
      </div>
    ) : (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">{slot.file.name.split('.').pop()?.toUpperCase()}</p>
        </div>
      </div>
    )}
    <div className="p-3 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <FileText className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate max-w-[140px]">{slot.file.name}</p>
          <p className="text-xs text-muted-foreground">{(slot.file.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onReplace} className="text-xs text-primary underline underline-offset-2 px-2">تغيير</button>
        <button onClick={onRemove} className="w-7 h-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </motion.div>
);

const UploadDesignPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);
  const { services, loading: servicesLoading } = useServices();

  const [step, setStep] = useState<Step>('service');
  const [slot1, setSlot1] = useState<FileSlot | null>(null);
  const [slot2, setSlot2] = useState<FileSlot | null>(null);
  const [selectedService, setSelectedService] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const selectedServiceData = services.find(s => s.id === selectedService);

  const formatPrice = (price: number, minQ?: number) => {
    if (!price) return null;
    const q = minQ || 1000;
    return `${price.toLocaleString('en-US')} د.ع / ${q.toLocaleString('en-US')}`;
  };

  const handleFileSelect = async (f: File, slot: 1 | 2) => {
    const err = validateFile(f);
    if (err) { toast({ title: err, variant: 'destructive' }); return; }
    const fileSlot = await toFileSlot(f);
    if (slot === 1) setSlot1(fileSlot);
    else setSlot2(fileSlot);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f, slot);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelect(f, 1);
  };

  const handleSubmit = async () => {
    if (!slot1 || !selectedService || !user) return;
    setSubmitting(true);

    try {
      // Pricing snapshot: no quantity input here, so order the service min_quantity.
      const catalog = buildCatalog(services);
      const quantity = catalog[selectedService]?.min_quantity || 1000;
      const pricing = buildPricingSnapshot(catalog, selectedService, quantity);

      // 1. Create order
      const { data: orderData, error: orderError } = await insertOrder(
        user.id,
        { order_type: 'ready_design', service_type: selectedService, attachment_urls: [], quantity, pricing } as unknown as Json,
      );

      if (orderError || !orderData) throw orderError;

      // 2. Upload files
      const filesToUpload: { file: File; name: string }[] = [
        { file: slot1.file, name: `ready_design_1.${slot1.file.name.split('.').pop()}` },
        ...(slot2 ? [{ file: slot2.file, name: `ready_design_2.${slot2.file.name.split('.').pop()}` }] : []),
      ];

      const publicUrls: string[] = [];
      for (const { file, name } of filesToUpload) {
        const path = `${orderData.id}/${name}`;
        const { error: uploadError } = await uploadOrderAttachment(path, file);
        if (uploadError) throw uploadError;
        publicUrls.push(getOrderAttachmentPublicUrl(path));
      }

      // 3. Update order with URLs
      await patchOrderDetails(
        orderData.id,
        { order_type: 'ready_design', service_type: selectedService, attachment_urls: publicUrls, quantity, pricing } as unknown as Json,
      );

      toast({ title: 'تم إرسال طلبك بنجاح ✅' });
      navigate(`/order-success?order=${orderData.id}`);
    } catch (e: unknown) {
      toast({ title: 'حدث خطأ', description: getUserFriendlyError(e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = step === 'service' ? !!selectedService : !!slot1;

  const steps: { key: Step; label: string }[] = [
    { key: 'service', label: 'نوع الخدمة' },
    { key: 'upload', label: 'رفع الملف' },
  ];

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
      <div className="container max-w-2xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={isNativeApp ? 'text-center mb-6' : 'text-center mb-10'}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-semibold mb-4">
            <Upload className="w-3.5 h-3.5" />
            تصميم جاهز للطباعة
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">ارفع تصميمك الجاهز</h1>
          <p className="text-muted-foreground text-sm">ارفع ملف تصميمك وسيراجعه المصمم قبل الطباعة</p>
        </motion.div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.map((s, i) => {
            const isActive = s.key === step;
            const isDone = (step === 'upload' && s.key === 'service');
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isDone ? 'bg-success text-success-foreground' :
                  isActive ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
                {i === 0 && <ChevronLeft className="w-4 h-4 text-muted-foreground/40" />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Select service */}
          {step === 'service' && (
            <motion.div key="service" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
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
                      {service.price > 0 && (
                        <p className="text-primary/80 font-bold text-xs mt-1">{formatPrice(service.price, service.min_quantity)}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Upload files */}
          {step === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
              {/* Selected service summary */}
              {selectedServiceData && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                      {selectedServiceData.icon_url ? (
                        <img src={selectedServiceData.icon_url} alt={selectedServiceData.label} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{selectedServiceData.icon}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{selectedServiceData.label}</p>
                      {selectedServiceData.price > 0 && (
                        <p className="text-primary font-bold text-xs">{formatPrice(selectedServiceData.price, selectedServiceData.min_quantity)}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setStep('service')} className="text-xs text-primary underline underline-offset-2">تغيير</button>
                </div>
              )}

              {/* Hidden inputs */}
              <input ref={fileInput1Ref} type="file" accept={ACCEPTED} className="hidden" onChange={e => handleInputChange(e, 1)} />
              <input ref={fileInput2Ref} type="file" accept={ACCEPTED} className="hidden" onChange={e => handleInputChange(e, 2)} />

              {/* Slot 1 — required */}
              <div>
                <Label className="text-sm font-bold text-foreground mb-2 block">الملف الأول <span className="text-destructive">*</span></Label>
                {!slot1 ? (
                  <DropZone
                    onDrop={handleDrop}
                    onClick={() => fileInput1Ref.current?.click()}
                  />
                ) : (
                  <FileCard
                    slot={slot1}
                    onRemove={() => setSlot1(null)}
                    onReplace={() => fileInput1Ref.current?.click()}
                    inputRef={fileInput1Ref}
                  />
                )}
              </div>

              {/* Slot 2 — optional */}
              <div>
                <Label className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                  الملف الثاني
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">اختياري</span>
                </Label>
                {!slot2 ? (
                  <button
                    onClick={() => fileInput2Ref.current?.click()}
                    className="w-full border-2 border-dashed border-border/40 hover:border-primary/40 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 hover:bg-primary/3 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-300">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">إضافة ملف ثانٍ (اختياري)</span>
                  </button>
                ) : (
                  <FileCard
                    slot={slot2}
                    onRemove={() => setSlot2(null)}
                    onReplace={() => fileInput2Ref.current?.click()}
                    inputRef={fileInput2Ref}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => setStep('service')} className="flex-1" disabled={submitting}>
              <ChevronRight className="w-4 h-4 ml-1" />
              السابق
            </Button>
          )}
          {step === 'service' ? (
            <Button onClick={() => setStep('upload')} disabled={!canProceed} size="lg" className="w-full">
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
