import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, FileText, Upload, X, Image, Loader2, ChevronLeft, ChevronRight, Check, Copy, Palette, Sparkles, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import { redeemCoupon, Coupon } from '@/hooks/useDiscounts';
import { IMAGE_PDF_ACCEPT, partitionAllowed } from '@/lib/uploadValidation';
import { buildAiOrderItemDetails } from '@/lib/aiDesign';
import { useServices } from '@/hooks/useServices';
import { buildCatalog, buildPricingSnapshot } from '@/lib/orderPricing';
import { retryAsync } from '@/lib/retry';
import {
  createCartOrderWithItems,
  uploadCartAttachment,
  getOrderAttachmentPublicUrl,
  isAlreadyExistsError,
} from '@/services/orders';
import { isNativeApp } from '@/lib/platform';
import type { Json } from '@/integrations/supabase/types';

interface TemplateData {
  id: string;
  name: string;
  preview_url: string | null;
  service_type: string;
}

/**
 * Stored in an item's details when the customer opts out of the design brief ("print my ready
 * artwork as-is"). A stable marker so designers/admin see the intent instead of a blank brief.
 */
const PRINT_AS_IS_MARKER = 'اطبعوا التصميم كما هو بدون تعديلات';

const CheckoutPage = () => {
  const { items, clearCart } = useCart();
  const { services } = useServices();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [_templates, setTemplates] = useState<Record<string, TemplateData>>({});
  const [details, setDetails] = useState<Record<string, string>>({});
  const [printAsIs, setPrintAsIs] = useState<Record<string, boolean>>({});
  const [attachments, setAttachments] = useState<Record<string, File[]>>({});
  const [previews, setPreviews] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Idempotency keys (order + per-item ids) generated once and reused across submit retries, so
  // an interrupted submit on a flaky network reconciles the SAME order instead of duplicating it.
  const idempotencyRef = useRef<{ orderId: string; itemIds: string[] } | null>(null);
  const getIdempotencyKeys = () => {
    if (!idempotencyRef.current || idempotencyRef.current.itemIds.length !== items.length) {
      idempotencyRef.current = {
        orderId: crypto.randomUUID(),
        itemIds: items.map(() => crypto.randomUUID()),
      };
    }
    return idempotencyRef.current;
  };

  // The brief is required only for non-AI items the customer wants edited (not "print as-is").
  const detailsRequired = (item: (typeof items)[number]) => !item.aiDesign && !printAsIs[item.templateId];

  // Effective brief stored on the item: the ready-to-print marker (plus any optional notes) when
  // "print as-is" is checked, otherwise the typed brief.
  const composeDetails = (item: (typeof items)[number]): string => {
    const typed = (details[item.templateId] || '').trim();
    if (printAsIs[item.templateId]) return typed ? `${PRINT_AS_IS_MARKER}\n${typed}` : PRINT_AS_IS_MARKER;
    return typed;
  };

  useEffect(() => {
    if (items.length === 0) { navigate('/cart'); return; }
    const load = async () => {
      // AI items have synthetic (non-UUID) ids and no template row — exclude them from the query.
      const ids = items.filter(i => !i.aiDesign).map(i => i.templateId);
      if (ids.length === 0) { setLoading(false); return; }
      const { data } = await supabase
        .from('templates')
        .select('id, name, preview_url, service_type')
        .in('id', ids) as unknown as { data: TemplateData[] | null };

      const map: Record<string, TemplateData> = {};
      (data || []).forEach(t => { map[t.id] = t; });
      setTemplates(map);
      setLoading(false);
    };
    load();
  }, [items, navigate]);

  const currentItem = items[currentStep];
  const totalSteps = items.length;
  const shortId = (id: string) => id.slice(0, 8).toUpperCase();

  const copyId = (id: string) => {
    navigator.clipboard.writeText(shortId(id));
    toast({ title: 'تم نسخ رقم القالب' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentItem) return;
    const tid = currentItem.templateId;
    const files = Array.from(e.target.files || []);
    const { ok: allowed, rejected } = partitionAllowed(files, { pdf: true });
    if (rejected.length) {
      toast({ title: 'صيغة غير مدعومة — PNG أو JPG أو PDF فقط', variant: 'destructive' });
    }
    const valid = allowed.filter(f => f.size <= 10 * 1024 * 1024);
    const current = attachments[tid] || [];
    if (current.length + valid.length > 5) {
      toast({ title: 'الحد الأقصى 5 صور', variant: 'destructive' });
      return;
    }
    setAttachments(prev => ({ ...prev, [tid]: [...current, ...valid] }));
    valid.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviews(prev => ({
        ...prev,
        [tid]: [...(prev[tid] || []), ev.target?.result as string],
      }));
      reader.readAsDataURL(f);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    if (!currentItem) return;
    const tid = currentItem.templateId;
    setAttachments(prev => ({ ...prev, [tid]: (prev[tid] || []).filter((_, i) => i !== index) }));
    setPreviews(prev => ({ ...prev, [tid]: (prev[tid] || []).filter((_, i) => i !== index) }));
  };

  const goNext = () => {
    if (!currentItem) return;
    if (detailsRequired(currentItem) && !details[currentItem.templateId]?.trim()) {
      toast({ title: 'يرجى إدخال تفاصيل التصميم', variant: 'destructive' });
      return;
    }
    if (currentStep < totalSteps - 1) setCurrentStep(s => s + 1);
  };

  const goPrev = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  /**
   * Upload one attachment with retry, using a STABLE path (orderId/itemIndex/fileIndex) so a
   * retried upload targets the same object. A file already stored by a prior attempt surfaces an
   * "already exists" error we treat as success — no duplicate files, no lost uploads. Throws if the
   * file still can't be uploaded after retries so the caller can block success.
   */
  const uploadItemFile = async (orderId: string, itemIndex: number, fileIndex: number, file: File): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${orderId}/${itemIndex}/${fileIndex}.${ext}`;
    await retryAsync(async () => {
      const { error } = await uploadCartAttachment(path, file);
      if (error && !isAlreadyExistsError(error)) throw error;
    });
    return getOrderAttachmentPublicUrl(path);
  };

  const handleSubmit = async () => {
    if (currentItem && detailsRequired(currentItem) && !details[currentItem.templateId]?.trim()) {
      toast({ title: 'يرجى إدخال تفاصيل التصميم', variant: 'destructive' });
      return;
    }
    if (!user) {
      toast({ title: 'يجب تسجيل الدخول أولاً', variant: 'destructive' });
      navigate('/auth');
      return;
    }
    // In-flight guard: never run two submits concurrently (belt-and-suspenders beyond the disabled button).
    if (submitting) return;

    setSubmitting(true);

    try {
      // Check for applied coupon
      let appliedCoupon: Coupon | null = null;
      try {
        const stored = sessionStorage.getItem('matbaty_coupon');
        if (stored) appliedCoupon = JSON.parse(stored);
      } catch { /* sessionStorage.getItem can throw if storage is blocked; silently skip coupon */ }

      // Build the pricing catalog once for this submit (snapshots are immutable).
      const catalog = buildCatalog(services);
      const couponPct = appliedCoupon?.percentage ?? 0;

      // Stable idempotency keys reused across retries.
      const { orderId, itemIds } = getIdempotencyKeys();

      // 1. Upload ALL attachments FIRST (before any DB write) so an order is never created with
      //    missing files. Files upload in parallel, each with its own retry. If ANY file can't be
      //    uploaded after retries, BLOCK success and keep the user on the page with state intact —
      //    a retry re-attempts only the still-missing uploads (stable paths make it idempotent).
      const urlsByItem: string[][] = Array.from({ length: items.length }, () => []);
      try {
        await Promise.all(items.map(async (item, index) => {
          if (item.aiDesign) return; // AI image is already uploaded
          const files = attachments[item.templateId] || [];
          urlsByItem[index] = await Promise.all(
            files.map((file, fileIndex) => uploadItemFile(orderId, index, fileIndex, file)),
          );
        }));
      } catch {
        toast({ title: 'بعض الملفات لم تُرفع، تحقق من الاتصال وحاول مجدداً', variant: 'destructive' });
        return; // stay on page; form state (files/brief) is preserved for retry
      }

      // 2. Build every item's details, then create the order + ALL its items in ONE atomic,
      //    idempotent RPC call. Uploads already succeeded, so each item carries its final
      //    attachment URLs — no insert-then-update, no partial rows. Because the whole write is a
      //    single transaction, a persistent failure can no longer leave a half-created 'submitted'
      //    order the customer can't delete; and the same client-supplied UUIDs + server-side
      //    ON CONFLICT make a retry after a dropped response reconcile the SAME order/items without
      //    duplicating. If it still can't be created after retries the error propagates below (we
      //    neither clear the cart nor navigate) and the form state is preserved for another retry.
      const orderItems = items.map((item, index) => ({
        id: itemIds[index],
        templateId: item.aiDesign ? null : item.templateId,
        details: (item.aiDesign
          ? buildAiOrderItemDetails({
              brief: item.aiDesign.brief,
              productType: item.aiDesign.productType,
              productLabel: item.aiDesign.productLabel,
              rewrittenPrompt: item.aiDesign.rewrittenPrompt,
              imageUrls: [item.aiDesign.imageUrl],
              quantity: 1,
              sizeLabel: item.aiDesign.sizeLabel,
              unitPrice: item.unitPrice,
              discountPct: couponPct,
            })
          : {
              details: composeDetails(item),
              attachment_urls: urlsByItem[index],
              quantity: item.quantity,
              cellophane: item.cellophane || null,
              pricing: buildPricingSnapshot(catalog, item.serviceType, item.quantity, { discountPct: couponPct, priceOverride: item.unitPrice }),
            }) as unknown as Json,
      }));

      await retryAsync(async () => {
        const { error } = await createCartOrderWithItems({
          orderId,
          userId: user.id,
          details: {
            item_count: items.length,
            ...(appliedCoupon ? { coupon_code: appliedCoupon.code, coupon_percentage: appliedCoupon.percentage } : {}),
          } as unknown as Json,
          items: orderItems,
        });
        if (error) throw error;
      });

      // 3. Consume the coupon, tied to this order (server enforces the cap atomically). Best-effort:
      //    a coupon failure must never block a fully-created order from completing.
      if (appliedCoupon) {
        try { await redeemCoupon(appliedCoupon.id, orderId); } catch { /* non-fatal */ }
        sessionStorage.removeItem('matbaty_coupon');
      }

      clearCart();
      navigate(`/order-success?order=${orderId}`);
    } catch (e: unknown) {
      toast({ title: 'تعذّر إرسال الطلب، تحقق من الاتصال وحاول مجدداً', description: getUserFriendlyError(e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={isNativeApp ? 'py-16 text-center' : 'py-24 text-center'}>
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (!currentItem) return null;

  const isAi = !!currentItem.aiDesign;
  const tid = currentItem.templateId;
  const curPreviews = previews[tid] || [];
  const curAttachments = attachments[tid] || [];

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
      <div className="container max-w-2xl">
        {!isNativeApp && (
          <Link to="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150">
            <ArrowRight className="w-4 h-4" />
            العودة للسلة
          </Link>
        )}

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">تفاصيل الطلب</h1>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-lg">{currentStep + 1} من {totalSteps}</span>
          </div>
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < currentStep ? 'bg-primary' : i === currentStep ? 'bg-primary/50' : 'bg-muted'}`} />
            ))}
          </div>
        </div>

        {/* Current template info */}
        <motion.div key={tid} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mb-6">
          <div className="rounded-2xl overflow-hidden border border-border/60 shadow-card">
            {currentItem.previewUrl ? (
              <img src={currentItem.previewUrl} alt="" className="w-full max-h-52 object-contain bg-muted/20" />
            ) : (
              <div className="h-32 bg-muted/30 flex items-center justify-center">
                <Palette className="w-10 h-10 text-muted-foreground/40" />
              </div>
            )}
            <div className="p-4 bg-card flex items-center justify-between">
              {isAi ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary" /> تصميم بالذكاء الاصطناعي
                    </p>
                    <p className="text-sm font-bold text-foreground mt-0.5">{currentItem.aiDesign!.productLabel}</p>
                    <p className="text-xs text-muted-foreground">{currentItem.aiDesign!.sizeLabel}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-extrabold text-success">{currentItem.unitPrice.toLocaleString('en-US')} د.ع</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">رقم القالب</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold text-primary text-lg tracking-widest">{shortId(tid)}</p>
                      <button onClick={() => copyId(tid)} className="text-muted-foreground hover:text-primary transition-colors">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">{SERVICE_LABELS[currentItem.serviceType as ServiceType]}</p>
                    <p className="text-sm font-medium text-foreground">{currentItem.quantity.toLocaleString('en-US')} نسخة</p>
                    {currentItem.cellophane && (
                      <p className="text-xs text-primary font-medium mt-0.5">
                        سيلفان: {currentItem.cellophane === 'matte' ? 'طافي' : 'لمّاع'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div key={`form-${tid}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {isAi && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-bold text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> تصميم جاهز بالذكاء الاصطناعي
              </p>
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{currentItem.aiDesign!.brief}</p>
              <p className="text-xs text-muted-foreground">
                سيراجع مصمّمنا التصميم ويجهّزه للطباعة بدقة. رسوم التصميم: {currentItem.unitPrice.toLocaleString('en-US')} د.ع
              </p>
            </div>
          )}
          {!isAi && (<>
          {/* Ready-to-print express option — makes the brief optional for finished artwork */}
          <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
            <Checkbox
              id={`print-as-is-${tid}`}
              checked={!!printAsIs[tid]}
              onCheckedChange={v => setPrintAsIs(prev => ({ ...prev, [tid]: v === true }))}
              className="mt-0.5 shrink-0"
            />
            <Label htmlFor={`print-as-is-${tid}`} className="text-sm text-foreground leading-relaxed font-normal cursor-pointer">
              {PRINT_AS_IS_MARKER}
              <span className="block text-xs text-muted-foreground mt-0.5">
                فعّل هذا الخيار إذا كان تصميمك جاهزاً للطباعة ولا يحتاج أي تعديل — عندها لن تحتاج لكتابة التفاصيل.
              </span>
            </Label>
          </div>

          <div>
            <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              تفاصيل التصميم {printAsIs[tid]
                ? <span className="text-muted-foreground font-normal">(اختياري)</span>
                : <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              value={details[tid] || ''}
              onChange={e => setDetails(prev => ({ ...prev, [tid]: e.target.value }))}
              placeholder={printAsIs[tid]
                ? 'ملاحظات إضافية للمصمم (اختياري)'
                : 'اكتب هنا كل البيانات التي تريدها على التصميم\nمثال: الاسم، رقم الهاتف، العنوان، المسمى الوظيفي...'}
              rows={6}
              className="text-right resize-none rounded-xl"
            />
          </div>

          {/* Image upload */}
          <div>
            <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
              <Image className="w-4 h-4 text-muted-foreground" />
              صور أو لوغوهات (اختياري)
            </Label>

            <input ref={fileInputRef} type="file" accept={IMAGE_PDF_ACCEPT} multiple onChange={handleFileSelect} className="hidden" />

            {curPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {curPreviews.map((src, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-border/60 aspect-square bg-muted/20">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeAttachment(i)} className="absolute top-1 left-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {curAttachments.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-5 text-center transition-all hover:bg-primary/5"
              >
                <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-sm font-medium text-foreground">اضغط لرفع صورة أو لوغو</p>
                <p className="text-xs text-muted-foreground mt-1">حتى {5 - curAttachments.length} صور • PNG, JPG, PDF</p>
              </button>
            )}
          </div>
          </>)}

          {/* Delivery-fee expectation — shown at the commit step; not a charge in any total */}
          {currentStep === totalSteps - 1 && (
            <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-muted-foreground">
              <Truck className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">رسوم التوصيل: تُحسب حسب المنطقة عند التوصيل</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-4">
            {currentStep > 0 && (
              <Button type="button" variant="outline" onClick={goPrev} className="flex-1 h-12 gap-2">
                <ChevronRight className="w-4 h-4" />
                السابق
              </Button>
            )}
            {currentStep < totalSteps - 1 ? (
              <Button type="button" onClick={goNext} className="flex-1 h-12 text-base font-bold gap-2">
                التالي
                <ChevronLeft className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 h-12 text-base font-bold gap-2 bg-success hover:bg-success/90 text-success-foreground"
              >
                {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> جاري الإرسال...</> : <><Check className="w-5 h-5" /> إرسال {totalSteps > 1 ? `${totalSteps} طلبات` : 'الطلب'}</>}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CheckoutPage;
