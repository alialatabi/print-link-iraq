import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, User, Phone, Briefcase, MapPin, Mail, FileText, Globe, Building2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import DesignCanvasPreview from '@/components/DesignCanvasPreview';

const FIELD_ICONS: Record<string, typeof User> = {
  name: User,
  phone: Phone,
  job_title: Briefcase,
  email: Mail,
  address: MapPin,
  company: Building2,
  website: Globe,
  custom1: FileText,
  custom2: FileText,
};

const FIELD_TYPES: Record<string, string> = {
  name: 'text',
  phone: 'tel',
  email: 'email',
  website: 'url',
  job_title: 'text',
  address: 'text',
  company: 'text',
  custom1: 'text',
  custom2: 'text',
};

const OrderForm = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [template, setTemplate] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId || '')
        .maybeSingle();
      setTemplate(data);

      // Initialize form values from text_fields
      if (data?.text_fields) {
        const initial: Record<string, string> = {};
        (data.text_fields as any[]).forEach((f: any) => {
          initial[f.key] = '';
        });
        setFormValues(initial);
      }
    };
    load();
  }, [templateId]);

  const textFields = (template?.text_fields || []) as any[];
  const hasTextFields = textFields.length > 0;
  const hasImage = !!template?.preview_url;

  const update = (key: string, value: string) => setFormValues(prev => ({ ...prev, [key]: value }));

  // Determine required fields: name and phone are always required if they exist
  const isRequired = (key: string) => ['name', 'phone'].includes(key);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    for (const field of textFields) {
      if (isRequired(field.key) && !formValues[field.key]?.trim()) {
        toast({ title: `${field.label} مطلوب`, variant: 'destructive' });
        return;
      }
    }

    if (!user) {
      toast({ title: 'يجب تسجيل الدخول أولاً', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        template_id: templateId,
        status: 'submitted' as any,
        customer_name: formValues.name || formValues.company || '-',
        customer_phone: formValues.phone || '-',
        details: { ...formValues, notes } as any,
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (error) {
      toast({ title: 'خطأ في إنشاء الطلب', description: getUserFriendlyError(error), variant: 'destructive' });
    } else if (data) {
      navigate(`/order-success?order=${data.id}`);
    }
  };

  // Fallback fields if no text_fields defined
  const fallbackFields = [
    { key: 'name', label: 'الاسم الكامل', placeholder: 'أحمد محمد' },
    { key: 'phone', label: 'رقم الهاتف', placeholder: '0770 123 4567' },
    { key: 'job_title', label: 'المسمى الوظيفي', placeholder: 'مدير تسويق' },
    { key: 'email', label: 'البريد الإلكتروني', placeholder: 'ahmed@mail.com' },
    { key: 'address', label: 'العنوان', placeholder: 'بغداد - الكرادة' },
  ];

  const fieldsToRender = hasTextFields
    ? textFields.map((f: any) => ({ key: f.key, label: f.label, placeholder: f.placeholder || f.label }))
    : fallbackFields;

  // Initialize fallback form values
  useEffect(() => {
    if (!hasTextFields && Object.keys(formValues).length === 0) {
      const initial: Record<string, string> = {};
      fallbackFields.forEach(f => { initial[f.key] = ''; });
      setFormValues(initial);
    }
  }, [hasTextFields]);

  const anyFieldFilled = Object.values(formValues).some(v => v.trim().length > 0);

  return (
    <div className="py-12">
      <div className="container max-w-5xl">
        <Link to={`/templates/${template?.service_type || 'business_card'}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-4 h-4" />
          العودة للقوالب
        </Link>

        {template && (
          <div className="bg-primary/5 rounded-lg p-4 mb-6 border border-primary/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-foreground">{template.name}</p>
              <p className="text-muted-foreground text-sm">{template.description}</p>
            </div>
            {template.price != null && (
              <span className="text-sm font-bold text-primary">{template.price.toLocaleString('en-US')} د.ع</span>
            )}
          </div>
        )}

        <div className={`grid gap-8 ${hasTextFields && hasImage ? 'lg:grid-cols-2' : ''}`}>
          {/* Form */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl font-bold text-foreground mb-2">تفاصيل التصميم</h1>
            <p className="text-muted-foreground mb-6">أدخل بياناتك وشاهد التصميم فوراً</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {fieldsToRender.map(f => {
                const Icon = FIELD_ICONS[f.key] || FileText;
                const type = FIELD_TYPES[f.key] || 'text';
                const required = isRequired(f.key);
                return (
                  <div key={f.key}>
                    <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      {f.label} {required && <span className="text-destructive">*</span>}
                    </Label>
                    <Input
                      type={type}
                      value={formValues[f.key] || ''}
                      onChange={e => update(f.key, e.target.value)}
                      required={required}
                      className="text-right"
                      placeholder={f.placeholder}
                    />
                  </div>
                );
              })}

              <div>
                <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  ملاحظات إضافية
                </Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="أي تفاصيل إضافية تريد إضافتها..."
                  rows={3}
                />
              </div>

              {/* Mobile preview toggle */}
              {hasTextFields && hasImage && anyFieldFilled && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full lg:hidden rounded-xl"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="w-4 h-4 ml-2" />
                  {showPreview ? 'إخفاء المعاينة' : 'معاينة التصميم'}
                </Button>
              )}

              {/* Mobile canvas preview */}
              {showPreview && hasTextFields && hasImage && (
                <div className="lg:hidden">
                  <DesignCanvasPreview
                    imageUrl={template.preview_url}
                    fields={textFields}
                    values={formValues}
                  />
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full bg-success hover:bg-success/90 text-success-foreground text-lg py-6 rounded-xl"
              >
                {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </Button>
            </form>
          </motion.div>

          {/* Desktop Canvas Preview */}
          {hasTextFields && hasImage && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="hidden lg:block sticky top-20"
            >
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                معاينة التصميم
              </h3>
              <DesignCanvasPreview
                imageUrl={template.preview_url}
                fields={textFields}
                values={formValues}
              />
              {!anyFieldFilled && (
                <p className="text-xs text-muted-foreground text-center mt-3">ابدأ بتعبئة البيانات لمشاهدة التصميم</p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderForm;
