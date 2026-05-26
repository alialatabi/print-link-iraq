import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, Sparkles, Loader2, Download, RefreshCw, Send, Wand2, Ruler, ShieldCheck, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useServices } from '@/hooks/useServices';
import SEOHead from '@/components/SEOHead';

const AiDesignPage = () => {
  const { serviceType } = useParams<{ serviceType: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { services } = useServices();

  const currentService = services.find(s => s.id === serviceType);
  const serviceLabel = currentService?.label || 'تصميم';

  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('');
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyReport, setVerifyReport] = useState<any | null>(null);

  // Extract quoted texts from the prompt (Arabic/English) — these are what must match exactly.
  const extractExpectedTexts = (p: string): string[] => {
    const re = /[«"'"'']([^«»"'""'']{1,120})[»"'"'']/g;
    const out: string[] = [];
    let m;
    while ((m = re.exec(p)) !== null) {
      const t = m[1].trim();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  };

  const runVerification = async (url: string) => {
    setVerifying(true);
    setVerifyReport(null);
    try {
      const expectedTexts = extractExpectedTexts(prompt);
      const { data, error } = await supabase.functions.invoke('ai-design-verify', {
        body: { imageUrl: url, expectedTexts },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setVerifyReport(data);
      if (!data.pass) {
        toast({
          title: 'فشل التحقق التلقائي',
          description: 'النصوص أو الألوان لا تطابق متطلبات الطباعة. أعد التوليد.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'تم التحقق ✓', description: 'النصوص مطابقة والألوان CMYK آمنة.' });
      }
    } catch (e: any) {
      toast({
        title: 'تعذّر التحقق التلقائي',
        description: e?.message || 'حاول مرة أخرى',
        variant: 'destructive',
      });
      setVerifyReport({ pass: false, report: { summary: e?.message || 'verification failed' } });
    } finally {
      setVerifying(false);
    }
  };

  const handleGenerate = async () => {
    if (prompt.trim().length < 5) {
      toast({ title: 'اكتب وصفاً أوضح للتصميم', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setImageUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-design-generate', {
        body: { prompt, serviceLabel, size },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error('لم يتم توليد صورة');
      setImageUrl(data.imageUrl);
      // Auto-run QA verification before allowing submission
      runVerification(data.imageUrl);
    } catch (e: any) {
      toast({ title: 'فشل توليد التصميم', description: e?.message || 'حاول مرة أخرى', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `ai-design-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSubmitOrder = async () => {
    if (!imageUrl) return;
    if (!verifyReport?.pass) {
      toast({
        title: 'لا يمكن إرسال الطلب',
        description: 'يجب أن ينجح التحقق التلقائي (نصوص 100% + ألوان CMYK) أولاً.',
        variant: 'destructive',
      });
      return;
    }
    if (!user) {
      navigate('/auth');
      return;
    }
    setSubmitting(true);
    try {
      // Convert data URL / remote URL to Blob
      const res = await fetch(imageUrl);
      const blob = await res.blob();

      // Create order first
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          status: 'submitted' as any,
          details: { details: `تصميم بالذكاء الاصطناعي:\n${prompt}`, attachment_urls: [], ai_generated: true } as any,
        } as any)
        .select('id')
        .single();
      if (orderErr || !order) throw orderErr || new Error('فشل إنشاء الطلب');

      // Upload generated image
      const path = `${order.id}/ai-design-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from('order-attachments')
        .upload(path, blob, { contentType: 'image/png' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('order-attachments').getPublicUrl(path);

      await supabase
        .from('orders')
        .update({
          details: { details: `تصميم بالذكاء الاصطناعي:\n${prompt}`, attachment_urls: [pub.publicUrl], ai_generated: true } as any,
        })
        .eq('id', order.id);

      navigate(`/order-success?order=${order.id}`);
    } catch (e: any) {
      toast({ title: 'فشل إرسال الطلب', description: e?.message || 'حاول مرة أخرى', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-8 sm:py-12">
      <SEOHead
        title={`تصميم بالذكاء الاصطناعي — ${serviceLabel}`}
        description={`أنشئ تصميم ${serviceLabel} فريداً بالذكاء الاصطناعي`}
        canonical={`/ai-design/${serviceType || ''}`}
      />
      <div className="container max-w-2xl">
        <Link
          to={serviceType ? `/templates/${serviceType}` : '/services'}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            ميزة جديدة
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2">
            تصميم {serviceLabel} بالذكاء الاصطناعي
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            اكتب وصفاً تفصيلياً للتصميم الذي تريده، وسيقوم الذكاء الاصطناعي بإنشائه لك خلال ثوانٍ.
          </p>
        </motion.div>

        <div className="space-y-5">
          <div>
            <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-muted-foreground" />
              وصف التصميم <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={`مثال: ${serviceLabel} لمطعم اسمه "النخيل" بألوان ذهبية وخضراء، خط عربي عصري، الرقم 07901234567، شعار شجرة نخيل بسيط...`}
              rows={7}
              disabled={generating}
              className="text-right resize-none rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">
              💡 ضع أي نص يجب أن يظهر حرفياً بين علامتي اقتباس "مثل هذا" — سيتم التحقق منه تلقائياً.
            </p>
          </div>

          <div>
            <Label className="text-foreground font-medium mb-2 flex items-center gap-2">
              <Ruler className="w-4 h-4 text-muted-foreground" />
              مقاس التصميم
            </Label>
            <Input
              value={size}
              onChange={e => setSize(e.target.value)}
              placeholder="مثال: 9×5 سم (كارت شخصي) أو A4 أو 50×70 سم"
              disabled={generating}
              className="text-right rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-2">
              📐 سيتم إرسال المقاس للذكاء الاصطناعي لاعتماد النسبة الصحيحة، مع استخدام ألوان CMYK مناسبة لطباعة الأوفست.
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || prompt.trim().length < 5}
            size="lg"
            className="w-full text-base py-6 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                جاري إنشاء التصميم...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 ml-2" />
                {imageUrl ? 'توليد تصميم جديد' : 'إنشاء التصميم'}
              </>
            )}
          </Button>

          <AnimatePresence>
            {generating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-border/60 bg-muted/20 aspect-square flex flex-col items-center justify-center gap-3"
              >
                <div className="relative">
                  <Sparkles className="w-12 h-12 text-primary animate-pulse" />
                </div>
                <p className="text-sm font-bold text-foreground">الذكاء الاصطناعي يصمم لك...</p>
                <p className="text-xs text-muted-foreground">قد يستغرق هذا 10-30 ثانية</p>
              </motion.div>
            )}

            {imageUrl && !generating && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="rounded-2xl overflow-hidden border border-border/60 shadow-card bg-muted/20">
                  <img src={imageUrl} alt="التصميم المولد" className="w-full object-contain" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || submitting || verifying}
                    variant="outline"
                    className="rounded-xl py-5"
                  >
                    <RefreshCw className="w-4 h-4 ml-2" />
                    إعادة توليد
                  </Button>
                  <Button
                    onClick={handleDownload}
                    disabled={submitting}
                    variant="outline"
                    className="rounded-xl py-5"
                  >
                    <Download className="w-4 h-4 ml-2" />
                    تحميل
                  </Button>
                </div>

                {/* Auto QA panel */}
                <div className={`rounded-2xl border p-4 ${
                  verifying ? 'border-border bg-muted/30'
                    : verifyReport?.pass ? 'border-success/40 bg-success/10'
                    : verifyReport ? 'border-destructive/40 bg-destructive/10'
                    : 'border-border bg-muted/20'
                }`}>
                  {verifying ? (
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      جاري التحقق من النصوص وألوان CMYK...
                    </div>
                  ) : verifyReport?.pass ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-success">
                        <ShieldCheck className="w-5 h-5" />
                        نجح التحقق التلقائي
                      </div>
                      <p className="text-xs text-muted-foreground">
                        النصوص مطابقة 100% والألوان ضمن نطاق CMYK الآمن للطباعة.
                      </p>
                    </div>
                  ) : verifyReport ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-destructive">
                        <ShieldAlert className="w-5 h-5" />
                        فشل التحقق — لا يمكن إرسال الطلب
                      </div>
                      {verifyReport.report?.text_results?.length > 0 && (
                        <ul className="space-y-1 text-xs">
                          {verifyReport.report.text_results.map((r: any, i: number) => (
                            <li key={i} className="flex items-start gap-1.5">
                              {r.match
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                                : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />}
                              <span className="text-foreground">
                                <span className="font-bold">«{r.expected}»</span>
                                {!r.match && r.found && <span className="text-muted-foreground"> — وُجد: «{r.found}»</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {verifyReport.report?.cmyk_safe === false && (
                        <div className="text-xs text-destructive">
                          ⚠️ ألوان خارج نطاق CMYK: {verifyReport.report.cmyk_issues?.join('، ') || 'غير محدد'}
                        </div>
                      )}
                      {verifyReport.report?.summary && (
                        <p className="text-xs text-muted-foreground">{verifyReport.report.summary}</p>
                      )}
                      <Button
                        size="sm" variant="outline"
                        onClick={() => imageUrl && runVerification(imageUrl)}
                        className="rounded-lg mt-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5 ml-1.5" />
                        إعادة التحقق
                      </Button>
                    </div>
                  ) : null}
                </div>

                <Button
                  onClick={handleSubmitOrder}
                  disabled={submitting || verifying || !verifyReport?.pass}
                  size="lg"
                  className="w-full bg-success hover:bg-success/90 text-success-foreground text-base py-6 rounded-xl"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 ml-2" />
                      إرسال التصميم كطلب
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default AiDesignPage;