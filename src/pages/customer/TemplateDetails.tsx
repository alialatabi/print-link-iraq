import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, TEMPLATE_ASPECT_RATIOS, ServiceType } from '@/data/mockData';
import { ArrowRight, Palette, Minus, Plus, ShoppingCart, Clock, Layers, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  price: number | null;
}

const PREPARATION_DAYS: Record<string, number> = {
  business_card: 3,
  flyer: 4,
  receipt: 2,
  letterhead: 3,
  menu: 5,
  invitation: 4,
};

const TemplateDetails = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<DbTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1); // quantity in thousands

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId || '')
        .single() as unknown as { data: DbTemplate | null };
      setTemplate(data);
      setLoading(false);
    };
    load();
  }, [templateId]);

  const unitPrice = template?.price || 0;
  const totalPrice = unitPrice * quantity;
  const prepDays = PREPARATION_DAYS[template?.service_type || ''] || 3;

  const decreaseQty = () => {
    if (quantity > 1) setQuantity(q => q - 1);
  };
  const increaseQty = () => {
    setQuantity(q => q + 1);
  };

  const handleOrder = () => {
    navigate(`/order/${templateId}?qty=${quantity * 1000}`);
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="py-20 text-center">
        <Palette className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground text-lg">القالب غير موجود</p>
        <Link to="/" className="text-primary mt-4 inline-block hover:underline">العودة للرئيسية</Link>
      </div>
    );
  }

  const serviceLabel = SERVICE_LABELS[template.service_type as ServiceType] || 'تصميم';

  return (
    <div className="py-8 sm:py-12">
      <div className="container max-w-5xl">
        <Link to={`/templates/${template.service_type}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-4 h-4" />
          العودة للقوالب
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Template Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl overflow-hidden border border-border shadow-card bg-card"
          >
            {template.preview_url ? (
              <div style={{ aspectRatio: TEMPLATE_ASPECT_RATIOS[template.service_type as ServiceType] || '3/4' }} className="overflow-hidden">
                <img
                  src={template.preview_url}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center" style={{ aspectRatio: TEMPLATE_ASPECT_RATIOS[template.service_type as ServiceType] || '3/4' }}>
                <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <Palette className="w-12 h-12 text-primary" />
                </div>
              </div>
            )}
          </motion.div>

          {/* Template Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Title & Service Badge */}
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
                {serviceLabel}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{template.name}</h1>
              {template.description && (
                <p className="text-muted-foreground mt-2 leading-relaxed">{template.description}</p>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">نوع الخدمة</p>
                  <p className="font-bold text-foreground text-sm">{serviceLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">مدة التجهيز</p>
                  <p className="font-bold text-foreground text-sm">{prepDays} أيام عمل</p>
                </div>
              </div>
            </div>

            {/* Price per 1000 */}
            <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">سعر الألف نسخة</p>
              </div>
              <p className="text-2xl font-bold text-primary">
                {unitPrice.toLocaleString('ar-IQ')} <span className="text-base font-medium">د.ع</span>
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="p-5 rounded-xl bg-card border border-border shadow-sm">
              <label className="text-sm font-bold text-foreground mb-3 block">الكمية (بالآلاف)</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={decreaseQty}
                  disabled={quantity <= 1}
                  className="rounded-xl h-12 w-12"
                >
                  <Minus className="w-5 h-5" />
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-bold text-foreground">{quantity}</span>
                  <span className="text-muted-foreground text-sm mr-1">ألف</span>
                  <p className="text-xs text-muted-foreground mt-1">({(quantity * 1000).toLocaleString('ar-IQ')} نسخة)</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={increaseQty}
                  className="rounded-xl h-12 w-12"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Total & Order Button */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-muted-foreground font-medium">المجموع الكلي</span>
                <span className="text-2xl font-bold text-primary">
                  {totalPrice.toLocaleString('ar-IQ')} <span className="text-sm font-medium">د.ع</span>
                </span>
              </div>
              <Button onClick={handleOrder} className="w-full h-12 rounded-xl text-base font-bold gap-2">
                <ShoppingCart className="w-5 h-5" />
                اطلب الآن
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default TemplateDetails;
