import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, CartItem } from '@/contexts/CartContext';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowRight, User, Phone, Briefcase, MapPin, Mail, FileText, Globe, Building2, Check, ChevronLeft, ChevronRight, Copy, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';

const FIELD_ICONS: Record<string, typeof User> = {
  name: User, phone: Phone, job_title: Briefcase, email: Mail,
  address: MapPin, company: Building2, website: Globe, custom1: FileText, custom2: FileText,
};

const FIELD_TYPES: Record<string, string> = {
  name: 'text', phone: 'tel', email: 'email', website: 'url',
  job_title: 'text', address: 'text', company: 'text', custom1: 'text', custom2: 'text',
};

const FALLBACK_FIELDS = [
  { key: 'name', label: 'الاسم الكامل', placeholder: 'أحمد محمد' },
  { key: 'phone', label: 'رقم الهاتف', placeholder: '0770 123 4567' },
  { key: 'job_title', label: 'المسمى الوظيفي', placeholder: 'مدير تسويق' },
  { key: 'email', label: 'البريد الإلكتروني', placeholder: 'ahmed@mail.com' },
  { key: 'address', label: 'العنوان', placeholder: 'بغداد - الكرادة' },
];

interface TemplateData {
  id: string;
  text_fields: any[];
  name: string;
  preview_url: string | null;
  service_type: string;
}

const CheckoutPage = () => {
  const { items, clearCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [templates, setTemplates] = useState<Record<string, TemplateData>>({});
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (items.length === 0) { navigate('/cart'); return; }
    const load = async () => {
      const ids = items.map(i => i.templateId);
      const { data } = await supabase
        .from('templates')
        .select('id, text_fields, name, preview_url, service_type')
        .in('id', ids) as unknown as { data: TemplateData[] | null };

      const map: Record<string, TemplateData> = {};
      const initial: Record<string, Record<string, string>> = {};
      (data || []).forEach(t => {
        map[t.id] = t;
        const fields = (t.text_fields as any[]) || [];
        const vals: Record<string, string> = {};
        if (fields.length > 0) {
          fields.forEach((f: any) => { vals[f.key] = ''; });
        } else {
          FALLBACK_FIELDS.forEach(f => { vals[f.key] = ''; });
        }
        initial[t.id] = vals;
      });
      setTemplates(map);
      setFormData(initial);
      setLoading(false);
    };
    load();
  }, [items]);

  const currentItem = items[currentStep];
  const currentTemplate = currentItem ? templates[currentItem.templateId] : null;
  const totalSteps = items.length;

  const getFieldsForTemplate = (t: TemplateData | null) => {
    if (!t) return FALLBACK_FIELDS;
    const fields = (t.text_fields as any[]) || [];
    if (fields.length > 0) return fields.map((f: any) => ({ key: f.key, label: f.label, placeholder: f.placeholder || f.label }));
    return FALLBACK_FIELDS;
  };

  const isRequired = (key: string) => ['name', 'phone'].includes(key);

  const updateField = (templateId: string, key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [templateId]: { ...prev[templateId], [key]: value },
    }));
  };

  const copyFromPrevious = () => {
    if (currentStep === 0) return;
    const prevItem = items[currentStep - 1];
    const prevData = formData[prevItem.templateId];
    if (!prevData || !currentItem) return;
    setFormData(prev => ({
      ...prev,
      [currentItem.templateId]: { ...prev[currentItem.templateId], ...prevData },
    }));
    setNotes(prev => ({
      ...prev,
      [currentItem.templateId]: prev[prevItem.templateId] || '',
    }));
    toast({ title: 'تم نسخ البيانات من القالب السابق' });
  };

  const validateCurrentStep = () => {
    if (!currentItem) return false;
    const fields = getFieldsForTemplate(currentTemplate);
    const vals = formData[currentItem.templateId] || {};
    for (const f of fields) {
      if (isRequired(f.key) && !vals[f.key]?.trim()) {
        toast({ title: `${f.label} مطلوب`, variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < totalSteps - 1) setCurrentStep(s => s + 1);
  };

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    if (!user) {
      toast({ title: 'يجب تسجيل الدخول أولاً', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    setSubmitting(true);
    const orders = items.map(item => {
      const vals = formData[item.templateId] || {};
      return {
        customer_id: user.id,
        template_id: item.templateId,
        status: 'submitted' as any,
        customer_name: vals.name || vals.company || '-',
        customer_phone: vals.phone || '-',
        details: { ...vals, notes: notes[item.templateId] || '', quantity: item.quantity * 1000 } as any,
      };
    });

    const { error } = await supabase.from('orders').insert(orders);
    setSubmitting(false);

    if (error) {
      toast({ title: 'خطأ في إنشاء الطلبات', description: getUserFriendlyError(error), variant: 'destructive' });
    } else {
      clearCart();
      navigate('/order-success');
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

  const fields = getFieldsForTemplate(currentTemplate);
  const vals = formData[currentItem.templateId] || {};

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-2xl">
        <Link to="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150">
          <ArrowRight className="w-4 h-4" />
          العودة للسلة
        </Link>

        {/* Progress */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">تفاصيل التصميم</h1>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-3 py-1 rounded-lg">{currentStep + 1} من {totalSteps}</span>
          </div>
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  i < currentStep ? 'bg-primary' : i === currentStep ? 'bg-primary/50' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Current template info */}
        <motion.div
          key={currentItem.templateId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border/60 shadow-card">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
              {currentItem.previewUrl ? (
                <img src={currentItem.previewUrl} alt={currentItem.templateName} className="w-full h-full object-cover" />
              ) : (
                <Palette className="w-6 h-6 text-muted-foreground/40" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">{currentItem.templateName}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {SERVICE_LABELS[currentItem.serviceType as ServiceType]} · {currentItem.quantity} ألف نسخة
              </p>
            </div>
          </div>

          {/* Copy from previous */}
          {currentStep > 0 && (
            <button
              onClick={copyFromPrevious}
              className="flex items-center gap-2 mt-3 text-sm text-primary hover:text-primary/80 transition-colors duration-150 font-medium"
            >
              <Copy className="w-4 h-4" />
              نسخ البيانات من القالب السابق
            </button>
          )}
        </motion.div>

        {/* Form */}
        <motion.form
          key={`form-${currentItem.templateId}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
          onSubmit={e => { e.preventDefault(); currentStep === totalSteps - 1 ? handleSubmit() : goNext(); }}
        >
          {fields.map((f: any) => {
            const Icon = FIELD_ICONS[f.key] || FileText;
            const type = FIELD_TYPES[f.key] || 'text';
            const required = isRequired(f.key);
            return (
              <div key={f.key}>
                <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  {f.label} {required && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  type={type}
                  value={vals[f.key] || ''}
                  onChange={e => updateField(currentItem.templateId, f.key, e.target.value)}
                  required={required}
                  className="text-right"
                  placeholder={f.placeholder}
                />
              </div>
            );
          })}

          <div>
            <Label className="text-foreground text-sm font-medium flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              ملاحظات إضافية
            </Label>
            <Textarea
              value={notes[currentItem.templateId] || ''}
              onChange={e => setNotes(prev => ({ ...prev, [currentItem.templateId]: e.target.value }))}
              placeholder="أي تفاصيل إضافية..."
              rows={3}
              className="rounded-xl"
            />
          </div>

          {/* Navigation */}
          <div className="flex gap-3 pt-6">
            {currentStep > 0 && (
              <Button type="button" variant="outline" onClick={goPrev} className="flex-1 h-12 gap-2">
                <ChevronRight className="w-4 h-4" />
                السابق
              </Button>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className={`flex-1 h-12 text-base font-bold gap-2 ${
                currentStep === totalSteps - 1 ? 'bg-success hover:bg-success/90 text-success-foreground' : ''
              }`}
            >
              {currentStep === totalSteps - 1
                ? submitting ? 'جاري الإرسال...' : `إرسال ${totalSteps > 1 ? `${totalSteps} طلبات` : 'الطلب'}`
                : 'التالي'}
              {currentStep < totalSteps - 1 && <ChevronLeft className="w-4 h-4" />}
              {currentStep === totalSteps - 1 && <Check className="w-5 h-5" />}
            </Button>
          </div>
        </motion.form>
      </div>
    </div>
  );
};

export default CheckoutPage;
