import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowRight, User, Phone, Briefcase, MapPin, Mail, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const OrderForm = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [template, setTemplate] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '', phone: '', job_title: '', address: '', email: '', notes: ''
  });

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

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;

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
        customer_name: form.name,
        customer_phone: form.phone,
        details: form as any,
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (error) {
      toast({ title: 'خطأ في إنشاء الطلب', description: error.message, variant: 'destructive' });
    } else if (data) {
      navigate(`/order-success?order=${data.id}`);
    }
  };

  const fields = [
    { key: 'name', label: 'الاسم الكامل', icon: User, required: true, type: 'text' },
    { key: 'phone', label: 'رقم الهاتف', icon: Phone, required: true, type: 'tel' },
    { key: 'job_title', label: 'المسمى الوظيفي', icon: Briefcase, required: false, type: 'text' },
    { key: 'email', label: 'البريد الإلكتروني', icon: Mail, required: false, type: 'email' },
    { key: 'address', label: 'العنوان', icon: MapPin, required: false, type: 'text' },
  ];

  return (
    <div className="py-12">
      <div className="container max-w-2xl">
        <Link to={`/templates/${template?.service_type || 'business_card'}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-4 h-4" />
          العودة للقوالب
        </Link>

        {template && (
          <div className="bg-primary/5 rounded-lg p-4 mb-6 border border-primary/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-foreground">{template.name}</p>
              <p className="text-muted-foreground text-sm">{template.description}</p>
            </div>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-2">تفاصيل التصميم</h1>
          <p className="text-muted-foreground mb-8">أدخل بياناتك لنقوم بتصميم المطبوعة</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {fields.map(f => (
              <div key={f.key}>
                <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                  <f.icon className="w-4 h-4 text-muted-foreground" />
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  type={f.type}
                  value={(form as any)[f.key]}
                  onChange={e => update(f.key, e.target.value)}
                  required={f.required}
                  className="text-right"
                  placeholder={f.label}
                />
              </div>
            ))}

            <div>
              <Label className="text-foreground font-medium flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                ملاحظات إضافية
              </Label>
              <Textarea
                value={form.notes}
                onChange={e => update('notes', e.target.value)}
                placeholder="أي تفاصيل إضافية تريد إضافتها..."
                rows={3}
              />
            </div>

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
      </div>
    </div>
  );
};

export default OrderForm;
