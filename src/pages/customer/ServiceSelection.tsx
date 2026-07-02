import { m as motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { useServices } from '@/hooks/useServices';
import SEOHead from '@/components/SEOHead';
import JsonLd, { breadcrumbSchema } from '@/components/JsonLd';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { useServiceDiscounts } from '@/hooks/useServiceDiscounts';
import DiscountBadge from '@/components/DiscountBadge';
import { isNativeApp } from '@/lib/platform';
import { getServiceIcon } from '@/lib/serviceIcons';
import { singleSubServiceTarget } from '@/lib/catalogSkip';
import { CategoryGridSkeleton, PageHeaderSkeleton } from '@/components/skeletons/CatalogSkeletons';

const ServiceSelection = () => {
  const { parentServices, getSubServices, loading: servicesLoading } = useServices();
  const { getDiscount } = useServiceDiscounts();

  // A category card surfaces the best deal inside it: the highest discount across the
  // category itself and any of its subservices (so a discounted product shows on the parent).
  const bestDiscount = (parentId: string) =>
    Math.max(getDiscount(parentId), 0, ...getSubServices(parentId).map(s => getDiscount(s.id)));

  if (servicesLoading) {
    return (
      <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
        <div className="container max-w-4xl">
          <PageHeaderSkeleton className={isNativeApp ? 'mb-6' : 'mb-12'} />
          <CategoryGridSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
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
        <div className={`text-center ${isNativeApp ? 'mb-6' : 'mb-12'}`}>
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

        {isNativeApp ? (
          // Native: a single-column list — icon beside the name, subservice count under it,
          // and an inline discount pill when a discount is active.
          <div className="space-y-3">
            {parentServices.map((service, i) => {
              const subs = getSubServices(service.id);
              const subCount = subs.length;
              // Single-child category: skip the one-item sub-service page and link
              // straight to that sub-service's templates.
              const skipTarget = singleSubServiceTarget(subs);
              const to = skipTarget ? `/templates/${skipTarget}` : `/sub-services/${service.id}`;
              const discount = bestDiscount(service.id);
              const Icon = getServiceIcon(service);
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={to}
                    className="group relative flex items-center gap-4 bg-card rounded-2xl p-4 shadow-card border border-border/60 active:scale-[0.99] transition-all duration-200 overflow-hidden"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0">
                      <Icon className="w-7 h-7 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground truncate">{service.label}</h3>
                        {discount > 0 && (
                          <span className="shrink-0 bg-cmyk-magenta/10 text-cmyk-magenta text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                            خصم حتى {discount}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {subCount} {subCount === 1 ? 'خدمة متاحة' : 'خدمات متاحة'}
                      </p>
                    </div>
                    <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 auto-rows-fr gap-5 sm:gap-6">
            {parentServices.map((service, i) => {
              // Single-child category: link straight to the lone sub-service's templates.
              const skipTarget = singleSubServiceTarget(getSubServices(service.id));
              const to = skipTarget ? `/templates/${skipTarget}` : `/sub-services/${service.id}`;
              return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07 }}
              >
                <Link
                  to={to}
                  className="group relative h-full flex flex-col justify-center bg-card rounded-2xl p-6 sm:p-8 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/60 overflow-hidden"
                >
                  <DiscountBadge percentage={bestDiscount(service.id)} />
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceSelection;
