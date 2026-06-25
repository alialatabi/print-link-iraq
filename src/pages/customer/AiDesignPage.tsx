import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { m as motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Sparkles, Loader2, RefreshCw, ShoppingCart, Wand2, Ruler, Archive, Pencil, Send, ImagePlus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SEOHead from '@/components/SEOHead';
import { generateAiDesign, resolveRequest, uploadAiDraftImage, createAiEditOrder, AI_DESIGN_FEE, GenerateResult } from '@/lib/aiDesign';
import { useAiProducts } from '@/hooks/useAiProducts';
import { saveAiDesignToVault } from '@/lib/designVault';
import { fileToDownscaledDataUrl } from '@/lib/imageUtils';

const MAX_REF_IMAGES = 3;

const AiDesignPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();

  const { products, loading: productsLoading } = useAiProducts();
  const [productType, setProductType] = useState('');
  const [optionId, setOptionId] = useState('');
  const [customSize, setCustomSize] = useState('');
  const [brief, setBrief] = useState('');
  const [refImages, setRefImages] = useState<{ id: string; dataUrl: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [sendingEdit, setSendingEdit] = useState(false);

  const selected = products.find(p => p.id === productType) || products[0];

  // Pick the first product once the catalog loads.
  useEffect(() => {
    if (products.length && !productType) {
      setProductType(products[0].id);
      setOptionId(products[0].options?.[0]?.id ?? '');
    }
  }, [products, productType]);

  const priceOf = (p?: { price?: number }) => p?.price ?? AI_DESIGN_FEE;

  const handleProductChange = (next: string) => {
    setProductType(next);
    const nextProduct = products.find(p => p.id === next) || products[0];
    setOptionId(nextProduct?.options?.[0]?.id ?? '');
    setCustomSize('');
  };

  // Reference / logo images: read, downscale (longest side ≤ 1024px) and keep as data URLs.
  const handleAddRefImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_REF_IMAGES - refImages.length;
    if (room <= 0) { toast({ title: `الحد الأقصى ${MAX_REF_IMAGES} صور`, variant: 'destructive' }); return; }
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith('image/')) { toast({ title: 'يرجى اختيار صور فقط', variant: 'destructive' }); continue; }
      if (file.size > 10 * 1024 * 1024) { toast({ title: 'حجم الصورة كبير جداً (الحد 10MB)', variant: 'destructive' }); continue; }
      try {
        const dataUrl = await fileToDownscaledDataUrl(file, 1024);
        setRefImages(prev => (prev.length < MAX_REF_IMAGES ? [...prev, { id: crypto.randomUUID(), dataUrl }] : prev));
      } catch {
        toast({ title: 'تعذّر معالجة الصورة', variant: 'destructive' });
      }
    }
  };

  const removeRefImage = (id: string) => setRefImages(prev => prev.filter(r => r.id !== id));

  const handleGenerate = async () => {
    if (brief.trim().length < 5) {
      toast({ title: 'اكتب وصفاً أوضح للتصميم', variant: 'destructive' });
      return;
    }
    if (selected.customSize && customSize.trim() === '') {
      toast({ title: 'أدخل القياس المطلوب', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setResult(null);
    setEditMode(false);
    setEditText('');
    try {
      const req = resolveRequest(selected, optionId, customSize);
      const res = await generateAiDesign({ brief, ...req, referenceImages: refImages.map(r => r.dataUrl) });
      setResult(res);
      setRemaining(res.remaining);
    } catch (e) {
      toast({
        title: 'فشل توليد التصميم',
        description: e instanceof Error ? e.message : 'حاول مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!result) return;
    if (!user) { navigate('/auth'); return; }
    setSaving(true);
    try {
      const req = resolveRequest(selected, optionId, customSize);
      await saveAiDesignToVault({
        userId: user.id,
        imageDataUrl: result.imageDataUrl,
        serviceType: req.productType,
        label: req.productLabel,
        brief,
        aiPrompt: result.rewrittenPrompt,
      });
      toast({ title: 'تم الحفظ في الخزنة ✓', description: 'يمكنك طلبه لاحقاً من خزنة التصاميم' });
    } catch (e) {
      toast({
        title: 'تعذّر الحفظ في الخزنة',
        description: e instanceof Error ? e.message : 'حاول مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async () => {
    if (!result) return;
    if (!user) { navigate('/auth'); return; }
    setSubmitting(true);
    try {
      const req = resolveRequest(selected, optionId, customSize);
      // Upload now so the cart stores a small URL instead of a ~2MB data URL.
      const imageUrl = await uploadAiDraftImage(user.id, result.imageDataUrl);
      addItem({
        templateId: `ai-${crypto.randomUUID()}`,
        templateName: `${req.productLabel} (تصميم AI)`,
        serviceType: 'ai_design',
        previewUrl: imageUrl,
        quantity: 1,
        unitPrice: priceOf(selected),
        minQuantity: 1,
        aiDesign: {
          brief,
          productType: req.productType,
          productLabel: req.productLabel,
          sizeLabel: req.sizeLabel,
          rewrittenPrompt: result.rewrittenPrompt,
          imageUrl,
        },
      });
      toast({ title: 'أضيف للسلة ✓', description: `${selected.label} — ${priceOf(selected).toLocaleString('en-US')} د.ع` });
      navigate('/cart');
    } catch (e) {
      toast({
        title: 'تعذّر الإضافة للسلة',
        description: e instanceof Error ? e.message : 'حاول مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Send the design + the customer's requested edits to a human designer (enters the
  // existing designer → review → approve/revise loop via the order's tracking page).
  const handleRequestEdit = async () => {
    if (!result) return;
    if (!user) { navigate('/auth'); return; }
    if (editText.trim().length < 3) {
      toast({ title: 'اكتب التعديلات المطلوبة', variant: 'destructive' });
      return;
    }
    setSendingEdit(true);
    try {
      const req = resolveRequest(selected, optionId, customSize);
      const orderId = await createAiEditOrder({
        userId: user.id,
        brief,
        productType: req.productType,
        productLabel: req.productLabel,
        sizeLabel: req.sizeLabel,
        rewrittenPrompt: result.rewrittenPrompt,
        imageDataUrl: result.imageDataUrl,
        editRequest: editText,
      });
      toast({ title: 'تم إرسال طلب التعديل ✓', description: 'سيقوم مصمّمنا بتنفيذ التعديلات وإرسالها لمراجعتك' });
      navigate(`/track-order/${orderId}`);
    } catch (e) {
      toast({
        title: 'تعذّر إرسال الطلب',
        description: e instanceof Error ? e.message : 'حاول مرة أخرى',
        variant: 'destructive',
      });
    } finally {
      setSendingEdit(false);
    }
  };

  const busy = generating || submitting || saving || sendingEdit;

  return (
    <div className="py-6 sm:py-10 bg-gradient-to-b from-primary/[0.04] to-transparent min-h-screen">
      <SEOHead
        title="تصميم بالذكاء الاصطناعي"
        description="أنشئ تصميمك المطبوع بالذكاء الاصطناعي خلال ثوانٍ، ثم يعتمده مصمّمنا للطباعة."
        canonical="/ai-design"
      />
      <div className="container max-w-2xl">
        <Link to="/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
          <ArrowRight className="w-4 h-4" />
          العودة للخدمات
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent p-6 sm:p-8 mb-6"
        >
          <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              ميزة جديدة
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 flex items-center gap-2">
              تصميم بالذكاء الاصطناعي
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
              اختر نوع المطبوعة، أرفق شعارك أو صوراً مرجعية إن وجدت، واكتب فكرتك — وسيُنشئ الذكاء الاصطناعي تصميمك خلال ثوانٍ. بعد اعتمادك يجهّزه مصمّمنا للطباعة.
            </p>
          </div>
        </motion.div>

        {!selected ? (
          <div className="py-16 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (
        <div className="space-y-4">
          {/* Step 1 — Product + size */}
          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-card rounded-2xl border border-border/60 shadow-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
              <Label className="text-foreground font-bold flex items-center gap-2">
                <Ruler className="w-4 h-4 text-primary" />
                نوع المطبوعة
              </Label>
            </div>
            <Select value={productType} onValueChange={handleProductChange} disabled={busy || productsLoading}>
              <SelectTrigger className="rounded-xl text-right h-12" dir="rtl">
                <SelectValue placeholder={productsLoading ? 'جاري التحميل...' : 'اختر نوع المطبوعة'} />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="font-medium">{p.label}</span>
                    <span className="text-primary font-bold mr-1">— {priceOf(p).toLocaleString('en-US')} د.ع</span>
                    {p.sizeLabel && <span className="text-muted-foreground text-xs mr-1">· {p.sizeLabel}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sub-option: cascading control that depends on the selected product */}
            {selected.options ? (
              <div>
                <Label className="text-foreground font-medium mb-2 flex items-center gap-2 text-sm">
                  <Ruler className="w-4 h-4 text-muted-foreground" />
                  {selected.optionLabel}
                </Label>
                <Select value={optionId} onValueChange={setOptionId} disabled={busy}>
                  <SelectTrigger className="rounded-xl text-right" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {selected.options.map(o => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label} <span className="text-muted-foreground">— {o.sizeLabel}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : selected.customSize ? (
              <div>
                <Label className="text-foreground font-medium mb-2 flex items-center gap-2 text-sm">
                  <Ruler className="w-4 h-4 text-muted-foreground" />
                  {selected.customSize.label}
                </Label>
                <Input
                  value={customSize}
                  onChange={e => setCustomSize(e.target.value)}
                  placeholder={selected.customSize.placeholder}
                  dir="rtl"
                  disabled={busy}
                  className="rounded-xl text-right"
                />
              </div>
            ) : selected.sizeLabel ? (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 inline-block">القياس: {selected.sizeLabel}</p>
            ) : null}
          </motion.section>

          {/* Step 2 — Reference / logo images */}
          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl border border-border/60 shadow-card p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
              <Label className="text-foreground font-bold flex items-center gap-2">
                <ImagePlus className="w-4 h-4 text-primary" />
                صور مرجعية / شعار
                <span className="text-[11px] font-normal text-muted-foreground">(اختياري)</span>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ارفع شعارك أو صوراً مرجعية ليُدمجها الذكاء الاصطناعي في التصميم (حتى {MAX_REF_IMAGES} صور).
            </p>
            <div className="grid grid-cols-3 gap-3">
              <AnimatePresence>
                {refImages.map(img => (
                  <motion.div
                    key={img.id}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted/30 group"
                  >
                    <img src={img.dataUrl} alt="مرجع" className="w-full h-full object-contain p-1" />
                    <button
                      type="button"
                      onClick={() => removeRefImage(img.id)}
                      disabled={busy}
                      className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive transition-colors"
                      aria-label="حذف الصورة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {refImages.length < MAX_REF_IMAGES && (
                <label className={`aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                  <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={e => { handleAddRefImages(e.target.files); e.currentTarget.value = ''; }} />
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground font-medium">إضافة صورة</span>
                </label>
              )}
            </div>
          </motion.section>

          {/* Step 3 — Brief */}
          <motion.section
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-card rounded-2xl border border-border/60 shadow-card p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">3</span>
              <Label className="text-foreground font-bold flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                وصف التصميم <span className="text-destructive">*</span>
              </Label>
            </div>
            <Textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              placeholder={`مثال: ${selected.label} لمطعم اسمه "النخيل" بألوان ذهبية وخضراء، خط عربي عصري، الرقم 07901234567، شعار شجرة نخيل بسيط...`}
              rows={6}
              disabled={busy}
              className="text-right resize-none rounded-xl"
            />
            <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 leading-relaxed">
              💡 ضع أي نص يجب أن يظهر حرفياً بين علامتي اقتباس "مثل هذا". سيتم استخدام ألوان CMYK مناسبة لطباعة الأوفست.
            </p>
          </motion.section>

          <Button
            onClick={handleGenerate}
            disabled={busy || brief.trim().length < 5}
            size="lg"
            className="w-full text-base py-7 rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-card-hover"
          >
            {generating ? (
              <><Loader2 className="w-5 h-5 ml-2 animate-spin" /> جاري إنشاء التصميم...</>
            ) : (
              <><Sparkles className="w-5 h-5 ml-2" /> {result ? 'توليد تصميم جديد' : 'إنشاء التصميم'}</>
            )}
          </Button>

          {remaining !== null && (
            <p className="text-xs text-center text-muted-foreground">
              المحاولات المتبقية اليوم: <span className="font-bold text-foreground">{remaining}</span>
            </p>
          )}

          <AnimatePresence>
            {generating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-border/60 bg-muted/20 aspect-square flex flex-col items-center justify-center gap-3"
              >
                <Sparkles className="w-12 h-12 text-primary animate-pulse" />
                <p className="text-sm font-bold text-foreground">الذكاء الاصطناعي يصمم لك...</p>
                <p className="text-xs text-muted-foreground">قد يستغرق هذا 10-30 ثانية</p>
              </motion.div>
            )}

            {result && !generating && (
              <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 rounded-2xl border border-primary/20 bg-card shadow-card p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Sparkles className="w-4 h-4" />
                  تصميمك جاهز
                </div>
                <div className="rounded-2xl overflow-hidden border border-border/60 shadow-card bg-muted/20">
                  <img src={result.imageDataUrl} alt="التصميم المولد" className="w-full object-contain" />
                </div>

                <p className="text-xs text-muted-foreground bg-muted/30 border border-border/50 rounded-xl p-3 leading-relaxed">
                  ℹ️ هذا تصميم أولي. قد تحتاج النصوص العربية إلى تدقيق — سيقوم مصمّمنا بمراجعته وتجهيزه للطباعة بدقة بعد اعتمادك. سعر هذا التصميم ({priceOf(selected).toLocaleString('en-US')} د.ع).
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={handleGenerate} disabled={busy} variant="outline" className="rounded-xl py-5">
                    <RefreshCw className="w-4 h-4 ml-2" />
                    إعادة توليد
                  </Button>
                  <Button onClick={handleSaveToVault} disabled={busy} variant="outline" className="rounded-xl py-5">
                    {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Archive className="w-4 h-4 ml-2" />}
                    حفظ في الخزنة
                  </Button>
                </div>

                <Button
                  onClick={handleAccept}
                  disabled={busy}
                  size="lg"
                  className="w-full bg-success hover:bg-success/90 text-success-foreground text-base py-6 rounded-xl"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 ml-2 animate-spin" /> جاري الإضافة...</>
                  ) : (
                    <><ShoppingCart className="w-5 h-5 ml-2" /> أضف للسلة — {priceOf(selected).toLocaleString('en-US')} د.ع</>
                  )}
                </Button>

                {/* Request human edits → goes to a designer, then back to the customer to review */}
                {!editMode ? (
                  <Button onClick={() => setEditMode(true)} disabled={busy} variant="outline" className="w-full rounded-xl py-5">
                    <Pencil className="w-4 h-4 ml-2" />
                    طلب تعديل من مصمم
                  </Button>
                ) : (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-primary">
                      <Pencil className="w-4 h-4" />
                      اكتب التعديلات المطلوبة
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      سيقوم أحد مصمّمينا بتنفيذ تعديلاتك يدوياً ثم يرسل التصميم لمراجعتك للموافقة عليه أو طلب تعديلات إضافية.
                    </p>
                    <Textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={4}
                      dir="rtl"
                      disabled={sendingEdit}
                      placeholder="مثال: كبّر اسم المطعم، غيّر اللون الذهبي إلى أزرق، صحّح رقم الهاتف إلى 0770...، أضف شعار..."
                      className="text-right resize-none rounded-xl"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleRequestEdit} disabled={sendingEdit || editText.trim().length < 3} className="flex-1 rounded-xl">
                        {sendingEdit ? (
                          <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الإرسال...</>
                        ) : (
                          <><Send className="w-4 h-4 ml-2" /> إرسال للمصمم</>
                        )}
                      </Button>
                      <Button onClick={() => setEditMode(false)} disabled={sendingEdit} variant="outline" className="rounded-xl">
                        إلغاء
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        )}
      </div>
    </div>
  );
};

export default AiDesignPage;
