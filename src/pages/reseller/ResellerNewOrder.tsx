import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, X, FileText, Loader2, Plus, Store, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import { useServices } from '@/hooks/useServices';
import { useResellerPricing } from '@/hooks/useResellerPricing';

const ACCEPTED = '.png,.jpg,.jpeg,.pdf,.psd';
const ALLOWED_EXTS = ['png', 'jpg', 'jpeg', 'pdf', 'psd'];

interface FileSlot {
  file: File;
  preview: string | null;
}

const CELLOPHANE_LABELS: Record<string, string> = {
  matte: 'سلوفان مطفي',
  glossy: 'سلوفان لامع',
};

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

const formatIQD = (n: number) => `${Math.round(n).toLocaleString('en-US')} د.ع`;

interface ReorderState {
  serviceId?: string;
  quantity?: number;
  cellophane?: string;
  attachmentUrls?: string[];
}

const ResellerNewOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { services, loading: servicesLoading } = useServices();
  const { getPrice, loading: pricingLoading } = useResellerPricing();

  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  const reorder = (location.state as { reorder?: ReorderState } | null)?.reorder;

  const [selectedService, setSelectedService] = useState<string>('');
  const [quantity, setQuantity] = useState<number | null>(null);
  const [selectedCellophane, setSelectedCellophane] = useState<string>('');
  const [slot1, setSlot1] = useState<FileSlot | null>(null);
  const [slot2, setSlot2] = useState<FileSlot | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedServiceData = services.find(s => s.id === selectedService);
  const minQty = selectedServiceData?.min_quantity || 1000;
  const cellophaneType: string = selectedServiceData?.cellophane_type || 'none';

  // Prefill from a re-order request
  useEffect(() => {
    if (!reorder) return;
    if (reorder.serviceId) setSelectedService(reorder.serviceId);
    if (reorder.quantity) setQuantity(reorder.quantity);
    if (reorder.cellophane) setSelectedCellophane(reorder.cellophane);
    if (reorder.attachmentUrls?.length) setExistingAttachments(reorder.attachmentUrls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialise quantity when a product is picked
  useEffect(() => {
    if (selectedServiceData && (quantity === null || quantity === 0)) {
      setQuantity(minQty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService]);

  // Default cellophane when needed
  useEffect(() => {
    if (cellophaneType === 'matte') setSelectedCellophane('matte');
    else if (cellophaneType === 'glossy') setSelectedCellophane('glossy');
    else if (cellophaneType === 'both' && !selectedCellophane) setSelectedCellophane('matte');
    else if (cellophaneType === 'none') setSelectedCellophane('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellophaneType]);

  const pricing = useMemo(() => {
    if (!selectedServiceData) return null;
    return getPrice({ id: selectedServiceData.id, price: selectedServiceData.price });
  }, [selectedServiceData, getPrice]);

  const qty = quantity || minQty;
  const total = pricing ? Math.ceil(pricing.unitPrice * (qty / minQty)) : 0;
  const originalTotal = pricing ? Math.ceil(pricing.originalUnitPrice * (qty / minQty)) : 0;
  const hasAttachment = !!slot1 || existingAttachments.length > 0;

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

  const handleSubmit = async () => {
    if (!selectedServiceData || !hasAttachment || !user) return;
    setSubmitting(true);

    const buildDetails = (attachment_urls: string[]) => ({
      order_type: 'reseller',
      service_type: selectedServiceData.id,
      service_label: selectedServiceData.label,
      quantity: qty,
      cellophane: selectedCellophane || null,
      attachment_urls,
      pricing: {
        type: pricing?.type ?? null,
        unit_price: pricing?.unitPrice ?? null,
        original_unit_price: pricing?.originalUnitPrice ?? null,
        min_quantity: minQty,
        total,
      },
    });

    try {
      // 1. Create the order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          status: 'submitted',
          details: buildDetails([]),
        })
        .select('id')
        .single();

      if (orderError || !orderData) throw orderError;

      // 2. Upload any new files
      const newFiles: { file: File; name: string }[] = [
        ...(slot1 ? [{ file: slot1.file, name: `design_1.${slot1.file.name.split('.').pop()}` }] : []),
        ...(slot2 ? [{ file: slot2.file, name: `design_2.${slot2.file.name.split('.').pop()}` }] : []),
      ];

      const uploadedUrls: string[] = [];
      for (const { file, name } of newFiles) {
        const path = `${orderData.id}/${name}`;
        const { error: uploadError } = await supabase.storage.from('order-attachments').upload(path, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(path);
        uploadedUrls.push(publicUrl);
      }

      const attachment_urls = [...existingAttachments, ...uploadedUrls];

      // 3. Save attachment urls
      await supabase.from('orders')
        .update({ details: buildDetails(attachment_urls) })
        .eq('id', orderData.id);

      toast({ title: 'تم إرسال طلبك بنجاح ✅' });
      navigate('/reseller');
    } catch (err: any) {
      toast({ title: 'حدث خطأ', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-semibold mb-4">
            <Store className="w-3.5 h-3.5" />
            طلب طباعة جديد
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">اختر المنتج وارفع تصميمك</h1>
          <p className="text-muted-foreground text-sm">بأسعار خاصة للمطابع والمكاتب</p>
        </motion.div>

        {/* 1) Product selection */}
        <div className="mb-8">
          <Label className="text-foreground font-semibold text-base block mb-4">١. اختر المنتج</Label>
          {servicesLoading || pricingLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">جاري التحميل...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {services.filter(s => s.price > 0).map(service => {
                const p = getPrice({ id: service.id, price: service.price });
                const isSel = selectedService === service.id;
                return (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service.id)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      isSel ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-card hover:border-primary/30'
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
                    <p className="text-primary/80 font-bold text-xs mt-1">
                      {formatIQD(p.unitPrice)} / {service.min_quantity.toLocaleString('en-US')}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedServiceData && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* 2) Quantity + options */}
            <div>
              <Label className="text-foreground font-semibold text-base block mb-4">٢. الكمية والخيارات</Label>
              <div className="bg-card rounded-2xl border border-border p-4 space-y-5">
                {/* Quantity */}
                <div>
                  <Label className="text-sm font-bold text-foreground mb-2 block">
                    الكمية <span className="text-xs font-normal text-muted-foreground">(الحد الأدنى {minQty.toLocaleString('en-US')})</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="rounded-xl"
                      onClick={() => setQuantity(Math.max(minQty, qty - minQty))}>
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      min={minQty}
                      step={minQty}
                      value={qty}
                      onChange={e => setQuantity(Math.max(minQty, Number(e.target.value) || minQty))}
                      className="text-center text-lg font-bold"
                    />
                    <Button type="button" variant="outline" size="icon" className="rounded-xl"
                      onClick={() => setQuantity(qty + minQty)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Cellophane */}
                {cellophaneType !== 'none' && (
                  <div>
                    <Label className="text-sm font-bold text-foreground mb-2 block">نوع السلوفان</Label>
                    <div className="flex gap-2">
                      {(cellophaneType === 'both' ? ['matte', 'glossy'] : [cellophaneType]).map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSelectedCellophane(opt)}
                          className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                            selectedCellophane === opt ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-card hover:border-primary/30'
                          }`}
                        >
                          {CELLOPHANE_LABELS[opt] || opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3) Upload design */}
            <div>
              <Label className="text-foreground font-semibold text-base block mb-4">٣. ارفع التصميم</Label>

              <input ref={fileInput1Ref} type="file" accept={ACCEPTED} className="hidden" onChange={e => handleInputChange(e, 1)} />
              <input ref={fileInput2Ref} type="file" accept={ACCEPTED} className="hidden" onChange={e => handleInputChange(e, 2)} />

              {/* Existing attachments (from re-order) */}
              {existingAttachments.length > 0 && (
                <div className="mb-3 space-y-2">
                  {existingAttachments.map((url, i) => (
                    <div key={url} className="flex items-center justify-between bg-muted/30 rounded-xl border border-border p-3">
                      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary truncate">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        ملف سابق {i + 1}
                      </a>
                      <button
                        onClick={() => setExistingAttachments(prev => prev.filter(u => u !== url))}
                        className="w-7 h-7 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Slot 1 */}
              {!slot1 ? (
                <button
                  onClick={() => fileInput1Ref.current?.click()}
                  className="w-full border-2 border-dashed border-border/60 hover:border-primary/40 rounded-2xl p-10 text-center cursor-pointer transition-all hover:bg-primary/5 flex flex-col items-center gap-3 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">اضغط لاختيار الملف</p>
                    <p className="text-muted-foreground text-xs mt-0.5">PNG, JPEG, PDF, PSD — حتى 30MB</p>
                  </div>
                </button>
              ) : (
                <FilePreview slot={slot1} onRemove={() => setSlot1(null)} onReplace={() => fileInput1Ref.current?.click()} />
              )}

              {/* Slot 2 (optional) */}
              <div className="mt-3">
                {!slot2 ? (
                  <button
                    onClick={() => fileInput2Ref.current?.click()}
                    className="w-full border-2 border-dashed border-border/40 hover:border-primary/40 rounded-2xl p-6 text-center cursor-pointer transition-all hover:bg-primary/5 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">إضافة ملف ثانٍ (اختياري)</span>
                  </button>
                ) : (
                  <FilePreview slot={slot2} onRemove={() => setSlot2(null)} onReplace={() => fileInput2Ref.current?.click()} />
                )}
              </div>
            </div>

            {/* Price summary */}
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">{selectedServiceData.label} × {qty.toLocaleString('en-US')}</span>
                {pricing && pricing.discountPercent > 0 && (
                  <span className="text-muted-foreground line-through">{formatIQD(originalTotal)}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">الإجمالي</span>
                <div className="text-left">
                  <span className="text-2xl font-extrabold text-primary">{formatIQD(total)}</span>
                  {pricing && pricing.discountPercent > 0 && (
                    <span className="block text-xs text-success font-semibold">خصم المطابع {pricing.discountPercent}%</span>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!hasAttachment || submitting}
              size="lg"
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 ml-2 animate-spin" />جاري الإرسال...</>
              ) : (
                'إرسال الطلب ✅'
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

const FilePreview = ({ slot, onRemove, onReplace }: { slot: FileSlot; onRemove: () => void; onReplace: () => void }) => (
  <div className="bg-card rounded-2xl border border-border overflow-hidden">
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
  </div>
);

export default ResellerNewOrder;
