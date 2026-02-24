import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useServices } from '@/hooks/useServices';
import { ArrowRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import JsonLd, { breadcrumbSchema } from '@/components/JsonLd';

const SubServiceSelection = () => {
  const { parentId } = useParams<{ parentId: string }>();
  const { parentServices, getSubServices, loading } = useServices();

  const parent = parentServices.find(s => s.id === parentId);
  const subServices = parentId ? getSubServices(parentId) : [];

  const formatPrice = (service: any) => {
    if (!service.price) return null;
    const minQ = service.min_quantity || 1000;
    return `${service.price.toLocaleString('en-US')} د.ع / ${minQ.toLocaleString('en-US')}`;
  };

  if (loading) {
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
        title={parent?.label || 'الخدمات الفرعية'}
        description={`اختر نوع المنتج المطلوب من ${parent?.label || 'الخدمات'} - مطبعتي، طباعة احترافية في العراق`}
        canonical={`/sub-services/${parentId}`}
      />
      <JsonLd data={breadcrumbSchema([
        { name: 'الرئيسية', url: '/' },
        { name: 'الخدمات', url: '/services' },
        { name: parent?.label || 'فرعية', url: `/sub-services/${parentId}` },
      ])} />
      <div className="container max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150">
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">
            {parent?.label || 'الخدمات الفرعية'}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            اختر نوع المنتج المطلوب
          </p>
        </div>

        {subServices.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-muted-foreground text-sm">لا توجد خدمات فرعية حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
            {subServices.map((service, i) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07 }}
              >
                <Link
                  to={`/templates/${service.id}`}
                  className="group block bg-card rounded-2xl p-6 sm:p-8 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/60"
                >
                  <div className="w-20 h-20 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                    {service.icon_url ? (
                      <img src={service.icon_url} alt={service.label} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">{service.icon}</span>
                    )}
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground mb-2">{service.label}</h3>
                  {service.price > 0 && (
                    <p className="text-primary font-bold text-sm mt-4">
                      {formatPrice(service)}
                    </p>
                  )}
                  {service.completion_days > 0 && (
                    <p className="text-muted-foreground text-xs mt-2">
                      ⏱ فترة الإنجاز: {service.completion_days} {service.completion_days === 1 ? 'يوم' : 'أيام'}
                    </p>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubServiceSelection;
