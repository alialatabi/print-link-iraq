import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, FileText, Upload, X, Image, Loader2, ChevronLeft, ChevronRight, Check, Copy, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import { incrementCouponUsage, Coupon } from '@/hooks/useDiscounts';
interface TemplateData {
  id: string;
  name: string;
  preview_url: string | null;
  service_type: string;
}

const CheckoutPage = () => {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [templates, setTemplates] = useState<Record<string, TemplateData>>({});
  const [details, setDetails] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Record<string, File[]>>({});
  const [previews, setPreviews] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (items.length === 0) { navigate('/cart'); return; }
    const load = async () => {
      const ids = items.map(i => i.templateId);
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
  }, [items]);

  const currentItem = items[currentStep];
  const currentTemplate = currentItem ? templates[currentItem.templateId] : null;
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
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024);
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
    if (!details[currentItem.templateId]?.trim()) {
      toast({ title: 'يرجى إدخال تفاصيل التصميم', variant: 'destructive' });
      return;
    }
    if (currentStep < totalSteps - 1) setCurrentStep(s => s + 1);
  };

  const goPrev = () => { if (currentStep > 0) setCurrentStep(s => s - 1); };

  const uploadAttachments = async (orderId: string, itemId: string, files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop();
      const path = `${orderId}/${itemId}/${Date.now()}_${i}.${ext}`;
      const { error } = await supabase.storage.from('order-attachments').upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(path);
        urls.push(publicUrl);
      }
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!currentItem || !details[currentItem.templateId]?.trim()) {
      toast({ title: 'يرجى إدخال تفاصيل التصميم', variant: 'destructive' });
      return;
    }
    if (!user) {
      toast({ title: 'يجب تسجيل الدخول أولاً', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    setSubmitting(true);

    try {
      // Check for applied coupon
      let appliedCoupon: Coupon | null = null;
      try {
        const stored = sessionStorage.getItem('matbaty_coupon');
        if (stored) appliedCoupon = JSON.parse(stored);
      } catch {}

      // 1. Create ONE order for the entire cart
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          status: 'submitted' as any,
          details: {
            item_count: items.length,
            ...(appliedCoupon ? { coupon_code: appliedCoupon.code, coupon_percentage: appliedCoupon.percentage } : {}),
          } as any,
        })
        .select('id')
        .single();

      if (orderError || !orderData) throw orderError;

      // 2. Create order_items for each cart item
      for (const item of items) {
        const itemDetails = details[item.templateId] || '';
        const itemFiles = attachments[item.templateId] || [];

        const { data: itemData, error: itemError } = await supabase
          .from('order_items' as any)
          .insert({
            order_id: orderData.id,
            template_id: item.templateId,
            details: { details: itemDetails, attachment_urls: [], quantity: item.quantity, cellophane: item.cellophane || null },
            status: 'submitted',
          })
          .select('id')
          .single();

        if (itemError || !itemData) continue;

        // Upload attachments per item
        if (itemFiles.length > 0) {
          const urls = await uploadAttachments(orderData.id, (itemData as any).id, itemFiles);
          await supabase
            .from('order_items' as any)
            .update({
              details: { details: itemDetails, attachment_urls: urls, quantity: item.quantity, cellophane: item.cellophane || null },
            })
            .eq('id', (itemData as any).id);
        }
      }

      // Increment coupon usage
      if (appliedCoupon) {
        await incrementCouponUsage(appliedCoupon.id);
        sessionStorage.removeItem('matbaty_coupon');
      }

      clearCart();
      navigate(`/order-success?order=${orderData.id}`);
    } catch (err: any) {
      toast({ title: 'حدث خطأ', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (!currentItem || !currentTemplate) return null;

  const tid = currentItem.templateId;
  const curPreviews = previews[tid] || [];
  const curAttachments = attachments[tid] || [];

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-2xl">
        <Link to="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150">
          <ArrowRight className="w-4 h-4" />
          العودة للسلة
        </Link>

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
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div key={`form-${tid}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div>
            <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              تفاصيل التصميم <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={details[tid] || ''}
              onChange={e => setDetails(prev => ({ ...prev, [tid]: e.target.value }))}
              placeholder="اكتب هنا كل البيانات التي تريدها على التصميم&#10;مثال: الاسم، رقم الهاتف، العنوان، المسمى الوظيفي..."
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

            <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFileSelect} className="hidden" />

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
