import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, TEMPLATE_ASPECT_RATIOS, ServiceType } from '@/data/mockData';
import { ArrowRight, Palette, Minus, Plus, ShoppingCart, Check } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  price: number | null;
  specializations: string[];
}

// ─── Thumbnail Gallery ────────────────────────────────────────────────────────
const Gallery = ({ previewUrl, name, aspectRatio }: { previewUrl: string | null; name: string; aspectRatio: string }) => {
  const [active, setActive] = useState(0);

  // We only have one image per template; we still show the "spot" thumbnails pattern
  const images = previewUrl ? [previewUrl] : [];

  if (!previewUrl) {
    return (
      <div
        className="rounded-2xl bg-muted/40 flex items-center justify-center border border-border/50"
        style={{ aspectRatio }}
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Palette className="w-12 h-12 opacity-40" />
          <span className="text-sm">لا توجد صورة</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 h-full">
      {/* Thumbnail strip – visible only when there are multiple images */}
      {images.length > 1 && (
        <div className="flex flex-col gap-2 w-16 shrink-0">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`rounded-lg overflow-hidden border-2 transition-all ${
                active === i ? 'border-primary shadow-md' : 'border-border/40 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="w-full object-cover aspect-square" />
            </button>
          ))}
        </div>
      )}

      {/* Main image */}
      <motion.div
        key={active}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="flex-1 rounded-2xl overflow-hidden border border-border/50 bg-card shadow-card cursor-zoom-in"
        onClick={() => window.open(images[active], '_blank')}
      >
        <img
          src={images[active]}
          alt={name}
          className="w-full h-full object-contain"
          style={{ aspectRatio }}
        />
      </motion.div>
    </div>
  );
};

// ─── Related Templates ────────────────────────────────────────────────────────
const RelatedTemplates = ({ serviceType, currentId }: { serviceType: string; currentId: string }) => {
  const [related, setRelated] = useState<DbTemplate[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('service_type', serviceType)
        .neq('id', currentId)
        .limit(4) as unknown as { data: DbTemplate[] };
      setRelated(data || []);
    };
    load();
  }, [serviceType, currentId]);

  if (!related.length) return null;

  const aspectRatio = TEMPLATE_ASPECT_RATIOS[serviceType as ServiceType] || '3/4';

  return (
    <section className="mt-16 pt-10 border-t border-border/40">
      <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
        <span className="w-1 h-5 bg-primary rounded-full inline-block" />
        قد يعجبك أيضاً
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {related.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Link
              to={`/template/${t.id}`}
              className="group block rounded-xl overflow-hidden border border-border/50 bg-card shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="overflow-hidden bg-muted/30" style={{ aspectRatio }}>
                {t.preview_url ? (
                  <img
                    src={t.preview_url}
                    alt=""
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Palette className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 8).toUpperCase()}</p>
                {t.price && (
                  <p className="text-sm font-bold text-success mt-0.5">
                    {t.price.toLocaleString('en-US')} <span className="text-xs font-normal text-muted-foreground">د.ع / ألف</span>
                  </p>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
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
  const isInCart = items.some(i => i.templateId === templateId);

  const handleAddToCart = () => {
    if (!template) return;
    addItem({
      templateId: template.id,
      templateName: template.name,
      serviceType: template.service_type,
      previewUrl: template.preview_url,
      quantity,
      unitPrice,
    });
    toast({ title: 'تمت الإضافة للسلة ✓', description: template.id.slice(0, 8).toUpperCase() });
  };

  const handleOrder = () => {
    handleAddToCart();
    navigate('/cart');
  };

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="section-spacing-sm">
        <div className="container max-w-5xl">
          <Skeleton className="h-5 w-32 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <Skeleton className="rounded-2xl" style={{ aspectRatio: '9/5.5' }} />
            <div className="flex flex-col gap-5">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          </div>
        </div>
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
  const aspectRatio = TEMPLATE_ASPECT_RATIOS[template.service_type as ServiceType] || '3/4';

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-5xl">
        {/* Breadcrumb */}
        <Link
          to={`/templates/${template.service_type}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          {serviceLabel}
        </Link>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-14 items-start">

          {/* ── LEFT: Gallery ── */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
            <Gallery previewUrl={template.preview_url} name={template.name} aspectRatio={aspectRatio} />
          </motion.div>

          {/* ── RIGHT: Info panel ── */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-5"
          >
            {/* Service tag + Template ID */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                {serviceLabel}
              </span>
              <span className="font-mono text-muted-foreground text-xs tracking-widest">
                #{templateId?.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {/* Price */}
            <div>
              <p className="text-xs text-muted-foreground mb-1">السعر لكل ألف نسخة</p>
              <p className="text-4xl font-extrabold text-foreground">
                {unitPrice.toLocaleString('en-US')}
                <span className="text-base font-semibold text-muted-foreground mr-1"> د.ع</span>
              </p>
            </div>

            {/* Description */}
            {template.description && (
              <p className="text-sm text-muted-foreground leading-relaxed border-r-2 border-border pr-3">
                {template.description}
              </p>
            )}

            <div className="h-px bg-border/50" />

            {/* Quantity */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-3 block uppercase tracking-wide">
                الكمية (بالآلاف)
              </label>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => quantity > 1 && setQuantity(q => q - 1)} disabled={quantity <= 1} className="h-11 w-11 rounded-xl">
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-black text-foreground">{quantity}</span>
                  <span className="text-muted-foreground text-sm mr-1">ألف</span>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">= {(quantity * 1000).toLocaleString('en-US')} نسخة</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1)} className="h-11 w-11 rounded-xl">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between py-4 px-5 rounded-xl bg-muted/40 border border-border/50">
              <span className="text-sm text-muted-foreground font-medium">المجموع</span>
              <span className="text-2xl font-black text-success">
                {totalPrice.toLocaleString('en-US')}
                <span className="text-sm font-semibold text-muted-foreground mr-1"> د.ع</span>
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleAddToCart}
                variant="outline"
                className="flex-1 h-12 font-bold gap-2 text-sm"
              >
                {isInCart ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                {isInCart ? 'في السلة ✓' : 'أضف للسلة'}
              </Button>
              <Button onClick={handleOrder} className="flex-1 h-12 font-bold text-sm">
                اطلب الآن
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Related Templates */}
        <RelatedTemplates serviceType={template.service_type} currentId={template.id} />
      </div>
    </div>
  );
};

export default TemplateDetails;
