import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, FileText, Upload, X, Image, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import { useServices } from '@/hooks/useServices';
import { buildCatalog, buildPricingSnapshot } from '@/lib/orderPricing';

const OrderForm = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { services } = useServices();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [template, setTemplate] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId || '')
        .maybeSingle();
      setTemplate(data);
    };
    load();
  }, [templateId]);

  const shortId = templateId ? templateId.slice(0, 8).toUpperCase() : '';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024);
    if (valid.length !== files.length) {
      toast({ title: 'بعض الملفات تجاوزت 10MB وتم تجاهلها', variant: 'destructive' });
    }
    if (attachments.length + valid.length > 5) {
      toast({ title: 'الحد الأقصى 5 صور', variant: 'destructive' });
      return;
    }
    setAttachments(prev => [...prev, ...valid]);
    valid.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviews(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (orderId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < attachments.length; i++) {
      const file = attachments[i];
      const ext = file.name.split('.').pop();
      const path = `${orderId}/${Date.now()}_${i}.${ext}`;
      const { error } = await supabase.storage
        .from('order-attachments')
        .upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(path);
        urls.push(publicUrl);
      }
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!details.trim()) {
      toast({ title: 'يرجى إدخال تفاصيل التصميم', variant: 'destructive' });
      return;
    }

    if (!user) {
      toast({ title: 'يجب تسجيل الدخول أولاً', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    setSubmitting(true);
    setUploading(true);

    // Pricing snapshot: this form has no quantity input, so order the service min_quantity.
    const catalog = buildCatalog(services);
    const serviceType: string = template?.service_type || '';
    const quantity = catalog[serviceType]?.min_quantity || 1000;
    const pricing = buildPricingSnapshot(catalog, serviceType, quantity);

    // First create the order to get an ID
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        template_id: templateId,
        status: 'submitted' as any,
        customer_name: user.id,
        customer_phone: '-',
        details: { details, attachment_urls: [], quantity, pricing } as any,
      })
      .select('id')
      .single();

    if (orderError || !orderData) {
      setSubmitting(false);
      setUploading(false);
      toast({ title: 'خطأ في إنشاء الطلب', description: getUserFriendlyError(orderError!), variant: 'destructive' });
      return;
    }

    // Upload attachments if any
    let attachmentUrls: string[] = [];
    if (attachments.length > 0) {
      attachmentUrls = await uploadAttachments(orderData.id);
    }
    setUploading(false);

    // Update order with attachment URLs
    if (attachmentUrls.length > 0) {
      await supabase
        .from('orders')
        .update({ details: { details, attachment_urls: attachmentUrls, quantity, pricing } as any })
        .eq('id', orderData.id);
    }

    setSubmitting(false);
    navigate(`/order-success?order=${orderData.id}`);
  };

  return (
    <div className="py-12">
      <div className="container max-w-2xl">
        <Link
          to={`/templates/${template?.service_type || 'business_card'}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للقوالب
        </Link>

        {/* Template Preview */}
        {template && (
          <div className="rounded-2xl overflow-hidden border border-border/60 shadow-card mb-6">
            {template.preview_url ? (
              <img
                src={template.preview_url}
                alt="القالب المختار"
                className="w-full object-contain max-h-72 bg-muted/20"
              />
            ) : (
              <div className="h-40 bg-muted/30 flex items-center justify-center">
                <Image className="w-12 h-12 text-muted-foreground/40" />
              </div>
            )}
            <div className="p-4 bg-card flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">رقم القالب</p>
                <p className="font-mono font-bold text-primary text-lg tracking-widest">{shortId}</p>
              </div>
              {/* Price is now set per service, not per template */}
            </div>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-1">تفاصيل الطلب</h1>
          <p className="text-muted-foreground text-sm mb-6">أدخل كل البيانات التي تريد وضعها على التصميم</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Details textarea */}
            <div>
              <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                تفاصيل التصميم <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="اكتب هنا كل البيانات التي تريدها على التصميم&#10;مثال: الاسم، رقم الهاتف، العنوان، المسمى الوظيفي، الموقع الإلكتروني..."
                rows={6}
                className="text-right resize-none rounded-xl"
                required
              />
            </div>

            {/* Image upload */}
            <div>
              <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                <Image className="w-4 h-4 text-muted-foreground" />
                صور أو لوغوهات (اختياري)
              </Label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Preview grid */}
              {previews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {previews.map((src, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden border border-border/60 aspect-square bg-muted/20">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="absolute top-1 left-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {attachments.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border hover:border-primary/40 rounded-xl p-6 text-center transition-all hover:bg-primary/5"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">اضغط لرفع صورة أو لوغو</p>
                  <p className="text-xs text-muted-foreground mt-1">حتى {5 - attachments.length} صور • PNG, JPG, PDF • حتى 10MB لكل ملف</p>
                </button>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full bg-success hover:bg-success/90 text-success-foreground text-lg py-6 rounded-xl"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                  {uploading ? 'جاري رفع الصور...' : 'جاري الإرسال...'}
                </>
              ) : 'إرسال الطلب'}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default OrderForm;
