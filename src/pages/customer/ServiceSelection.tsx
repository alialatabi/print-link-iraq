import { m as motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import SEOHead from '@/components/SEOHead';
import JsonLd, { breadcrumbSchema } from '@/components/JsonLd';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { useServiceDiscounts } from '@/hooks/useServiceDiscounts';
import DiscountBadge from '@/components/DiscountBadge';

const ServiceSelection = () => {
  const { parentServices, loading: servicesLoading } = useServices();
  const { getDiscount } = useServiceDiscounts();

  if (servicesLoading) {
    return (
      <div className="section-spacing-sm">
        <div className="container max-w-4xl text-center py-24">
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-spacing-sm">
      <SEOHead
        title="اختر نوع الخدمة"
        description="اختر نوع المطبوعة: كروت شخصية، فلايرات، وصولات، ترويسة، قوائم طعام، ودعوات. تصميم وطباعة احترافية في العراق."
        canonical="/services"
      />
      <JsonLd data={breadcrumbSchema([
        { name: 'الرئيسية', url: '/' },
        { name: 'الخدمات', url: '/services' },
      ])} />
      <div className="container max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">اختر نوع الخدمة</h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">حدد نوع المطبوعة التي تريد تصميمها</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link
            to="/ai-design"
            className="group relative flex items-center gap-4 bg-gradient-to-l from-primary/10 to-primary/5 rounded-2xl p-5 sm:p-6 border border-primary/30 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1 text-right">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 mb-1">
                ميزة جديدة
              </div>
              <h3 className="font-bold text-base sm:text-lg text-foreground">تصميم بالذكاء الاصطناعي</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">اكتب فكرتك ودع الذكاء الاصطناعي يصممها لك خلال ثوانٍ</p>
            </div>
            <ArrowLeft className="w-5 h-5 text-primary group-hover:-translate-x-1 transition-transform" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
          {parentServices.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
            >
              <Link
                to={`/sub-services/${service.id}`}
                className="group relative block bg-card rounded-2xl p-6 sm:p-8 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/60 overflow-hidden"
              >
                <DiscountBadge percentage={getDiscount(service.id)} />
                <div className="w-20 h-20 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                  {service.icon_url ? (
                    <img src={getOptimizedImageUrl(service.icon_url, { width: 160, height: 160 })} alt={service.label} loading="lazy" width="80" height="80" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">{service.icon}</span>
                  )}
                </div>
                <h3 className="font-bold text-base sm:text-lg text-foreground">{service.label}</h3>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServiceSelection;
