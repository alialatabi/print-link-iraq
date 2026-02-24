import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, TEMPLATE_ASPECT_RATIOS, ServiceType } from '@/data/mockData';
import { ArrowRight, Palette, Minus, Plus, ShoppingCart, Check, Shield, Truck, Printer, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServices } from '@/hooks/useServices';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  preview_urls: string[];
  specializations: string[];
}

// ─── Image Slider Gallery ─────────────────────────────────────────────────────
const Gallery = ({ images, name }: { images: string[]; name: string }) => {
  const [active, setActive] = useState(0);

  if (!images.length) {
    return (
      <div
        className="rounded-2xl bg-muted/40 flex items-center justify-center border border-border/50 w-full max-w-[2048px] mx-auto"
        style={{ aspectRatio: '1/1' }}
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Palette className="w-12 h-12 opacity-40" />
          <span className="text-sm">لا توجد صورة</span>
        </div>
      </div>
    );
  }

  const goNext = () => setActive(i => (i + 1) % images.length);
  const goPrev = () => setActive(i => (i - 1 + images.length) % images.length);

  return (
    <div className="w-full max-w-[2048px] mx-auto">
      {/* Main image container - square */}
      <div className="relative rounded-2xl overflow-hidden border border-border/40 bg-card shadow-card w-full" style={{ aspectRatio: '1/1' }}>
        <AnimatePresence mode="wait">
          <motion.img
            key={active}
            src={images[active]}
            alt={name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full object-contain"
          />
        </AnimatePresence>

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-foreground hover:bg-background transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goNext}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center text-foreground hover:bg-background transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots indicator */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  active === i ? 'bg-primary w-5' : 'bg-foreground/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 w-16 h-16 ${
                active === i ? 'border-primary shadow-md' : 'border-border/40 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
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
    <section className="mt-20 pt-12 border-t border-border/30">
      <motion.h2 initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
        <span className="w-1 h-5 bg-primary rounded-full inline-block" />
        قد يعجبك أيضاً
      </motion.h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {related.map((t, i) => (
          <motion.div
            key={t.id}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20px' }}
            variants={fadeUp}
            custom={i + 1}
          >
            <Link
              to={`/template/${t.id}`}
              className="group block rounded-2xl overflow-hidden border border-border/40 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-card-hover hover:-translate-y-1.5 transition-all duration-400"
            >
              <div className="overflow-hidden bg-muted/30" style={{ aspectRatio }}>
                {t.preview_url ? (
                  <img
                    src={t.preview_url}
                    alt=""
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Palette className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 8).toUpperCase()}</p>
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
  const { services } = useServices();

  const [template, setTemplate] = useState<DbTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1000);
  const [selectedCellophane, setSelectedCellophane] = useState<string>('');

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

  // Get price from service, not template
  const serviceData = services.find(s => s.id === template?.service_type) as any;
  const unitPrice = serviceData?.price || 0;
  const minQty = serviceData?.min_quantity || 1000;
  const cellophaneType: string = serviceData?.cellophane_type || 'none';
  const totalPrice = Math.ceil(unitPrice * (quantity / 1000));
  const isInCart = items.some(i => i.templateId === templateId);

  // Set initial quantity to min_quantity when service data loads
  useEffect(() => {
    if (minQty > 1 && quantity < minQty) setQuantity(minQty);
  }, [minQty]);

  // Set default cellophane when it's single type
  useEffect(() => {
    if (cellophaneType === 'matte') setSelectedCellophane('matte');
    else if (cellophaneType === 'glossy') setSelectedCellophane('glossy');
    else if (cellophaneType === 'both' && !selectedCellophane) setSelectedCellophane('matte');
  }, [cellophaneType]);

  const handleAddToCart = () => {
    if (!template) return;
    addItem({
      templateId: template.id,
      templateName: template.name,
      serviceType: template.service_type,
      previewUrl: template.preview_url,
      quantity,
      unitPrice,
      cellophane: cellophaneType !== 'none' ? selectedCellophane : undefined,
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
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <Link
            to={`/templates/${template.service_type}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-10 transition-colors duration-200"
          >
            <ArrowRight className="w-4 h-4" />
            {serviceLabel}
          </Link>
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* ── LEFT: Gallery ── */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
            <Gallery images={template.preview_urls?.length ? template.preview_urls : (template.preview_url ? [template.preview_url] : [])} name={template.name} />
          </motion.div>

          {/* ── RIGHT: Info panel ── */}
          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="flex flex-col gap-6"
          >
            {/* Service tag + Template ID */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                {serviceLabel}
              </span>
              <span className="font-mono text-muted-foreground text-xs tracking-widest">
                #{templateId?.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {/* Price */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">السعر لكل ألف نسخة</p>
              <p className="text-4xl font-extrabold text-foreground">
                {unitPrice.toLocaleString('en-US')}
                <span className="text-base font-semibold text-muted-foreground mr-1.5"> د.ع</span>
              </p>
            </div>

            {/* Description */}
            {template.description && (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line bg-muted/30 rounded-xl p-4 border border-border/40">
                {template.description}
              </p>
            )}

            {/* Cellophane option */}
            {cellophaneType !== 'none' && (
              <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">السيلفان</label>
                {cellophaneType === 'both' ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedCellophane('matte')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${selectedCellophane === 'matte' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
                    >
                      طافي
                    </button>
                    <button
                      onClick={() => setSelectedCellophane('glossy')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${selectedCellophane === 'glossy' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
                    >
                      لمّاع
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-foreground">
                    {cellophaneType === 'matte' ? '🟤 طافي' : '✨ لمّاع'}
                  </p>
                )}
              </div>
            )}

            {/* Completion days */}
            {serviceData && serviceData.completion_days > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-semibold text-foreground">
                  فترة الإنجاز: {serviceData.completion_days} {serviceData.completion_days === 1 ? 'يوم' : 'أيام'}
                </span>
              </div>
            )}

            <div className="h-px bg-border/30" />

            {/* Quantity */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-3 block uppercase tracking-wide">
                الكمية
              </label>
              <div className="flex items-center gap-4 bg-muted/20 rounded-xl p-3 border border-border/30">
                <Button variant="outline" size="icon" onClick={() => quantity > minQty && setQuantity(q => q - 1000)} disabled={quantity <= minQty} className="h-11 w-11 rounded-xl">
                  <Minus className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center">
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => {
                      const val = parseInt(e.target.value) || minQty;
                      setQuantity(Math.max(minQty, val));
                    }}
                    min={minQty}
                    className="w-full text-center text-3xl font-black text-foreground bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground/70 mt-0.5">الحد الأدنى: {minQty.toLocaleString('en-US')} نسخة</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1000)} className="h-11 w-11 rounded-xl">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between py-5 px-6 rounded-2xl bg-success/5 border border-success/15">
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
                className="flex-1 h-13 font-bold gap-2 text-sm rounded-xl"
              >
                {isInCart ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                {isInCart ? 'في السلة ✓' : 'أضف للسلة'}
              </Button>
              <Button onClick={handleOrder} className="flex-1 h-13 font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-shadow">
                اطلب الآن
              </Button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { icon: Shield, text: 'مراجعة قبل الطباعة' },
                { icon: Printer, text: 'جودة عالية' },
                { icon: Truck, text: 'توصيل لكل العراق' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 text-center p-3 rounded-xl bg-muted/30 border border-border/30">
                  <item.icon className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground leading-tight">{item.text}</span>
                </div>
              ))}
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
