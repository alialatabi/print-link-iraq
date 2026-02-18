import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, TEMPLATE_ASPECT_RATIOS, ServiceType } from '@/data/mockData';
import { ArrowRight, Palette, Minus, Plus, ShoppingCart, Clock, Layers, Info, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';

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
  const { addItem, items } = useCart();
  const { toast } = useToast();
  const [template, setTemplate] = useState<DbTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

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

  const isInCart = items.some(i => i.templateId === templateId);

  const handleAddToCart = () => {
    if (!template) return;
    addItem({
      templateId: template.id,
      templateName: template.name,
      serviceType: template.service_type,
      previewUrl: template.preview_url,
      quantity,
      unitPrice: unitPrice,
    });
    toast({ title: 'تمت الإضافة للسلة ✓', description: template.name });
  };

  const handleOrder = () => {
    handleAddToCart();
    navigate('/cart');
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Palette className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-base mb-3">القالب غير موجود</p>
        <Link to="/" className="text-primary hover:underline text-sm">العودة للرئيسية</Link>
      </div>
    );
  }

  const serviceLabel = SERVICE_LABELS[template.service_type as ServiceType] || 'تصميم';

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-5xl">
        <Link to={`/templates/${template.service_type}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150">
          <ArrowRight className="w-4 h-4" />
          العودة للقوالب
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
          {/* Template Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl overflow-hidden border border-border/60 shadow-card bg-card"
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
              <div className="bg-muted/40 flex items-center justify-center" style={{ aspectRatio: TEMPLATE_ASPECT_RATIOS[template.service_type as ServiceType] || '3/4' }}>
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
                  <Palette className="w-10 h-10 text-primary" />
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
              <span className="inline-block px-3 py-1 rounded-lg bg-primary/8 text-primary text-xs font-semibold mb-3">
                {serviceLabel}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{template.name}</h1>
              {template.description && (
                <p className="text-muted-foreground mt-3 leading-relaxed text-sm sm:text-base">{template.description}</p>
              )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 border border-border/50">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">نوع الخدمة</p>
                  <p className="font-bold text-foreground text-sm">{serviceLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 border border-border/50">
                <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">مدة التجهيز</p>
                  <p className="font-bold text-foreground text-sm">{prepDays} أيام عمل</p>
                </div>
              </div>
            </div>

            {/* Price per 1000 */}
            <div className="p-5 rounded-2xl bg-success/10 border-2 border-success/25">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-success" />
                <p className="text-xs font-medium text-success/80">سعر الألف نسخة</p>
              </div>
              <p className="text-3xl font-extrabold text-success">
                {unitPrice.toLocaleString('en-US')} <span className="text-base font-bold">د.ع</span>
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="p-5 rounded-2xl bg-card border border-border/60">
              <label className="text-sm font-bold text-foreground mb-3 block">الكمية (بالآلاف)</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={decreaseQty}
                  disabled={quantity <= 1}
                  className="h-12 w-12"
                >
                  <Minus className="w-5 h-5" />
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-extrabold text-foreground">{quantity}</span>
                  <span className="text-muted-foreground text-sm mr-1">ألف</span>
                  <p className="text-xs text-muted-foreground mt-0.5">({(quantity * 1000).toLocaleString('en-US')} نسخة)</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={increaseQty}
                  className="h-12 w-12"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Total & Order Buttons */}
            <div className="p-5 rounded-2xl bg-muted/30 border border-border/50">
              <div className="flex items-center justify-between mb-5">
                <span className="text-muted-foreground font-medium text-sm">المجموع الكلي</span>
                <span className="text-2xl font-extrabold text-success">
                  {totalPrice.toLocaleString('en-US')} <span className="text-sm font-bold">د.ع</span>
                </span>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleAddToCart} variant="outline" className="flex-1 h-12 text-sm font-bold gap-2">
                  {isInCart ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                  {isInCart ? 'في السلة ✓' : 'أضف للسلة'}
                </Button>
                <Button onClick={handleOrder} className="flex-1 h-12 text-sm font-bold gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  اطلب الآن
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default TemplateDetails;
