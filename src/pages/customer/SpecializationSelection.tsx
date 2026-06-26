import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useServices, useSpecializations } from '@/hooks/useServices';
import { ArrowRight } from 'lucide-react';
import SEOHead from '@/components/SEOHead';
import JsonLd, { breadcrumbSchema } from '@/components/JsonLd';
import { isNativeApp } from '@/lib/platform';

const SpecializationSelection = () => {
  const { serviceType } = useParams<{ serviceType: string }>();
  const { services } = useServices();
  const { specializations, loading: specsLoading } = useSpecializations();
  const [availableSpecs, setAvailableSpecs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const currentService = services.find(s => s.id === serviceType);
  const serviceLabel = currentService?.label || 'التصميم';
  // Find parent for back navigation
  const parentId = currentService?.parent_id;

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('templates')
        .select('specializations')
        .eq('service_type', serviceType || '');

      const specs = new Set<string>();
      if (data) {
        for (const row of data) {
          const arr = row.specializations;
          if (Array.isArray(arr)) {
            arr.forEach((s: string) => specs.add(s));
          }
        }
      }
      setAvailableSpecs(specs);
      setLoading(false);
    };
    load();
  }, [serviceType]);

  const isLoading = loading || specsLoading;

  const specsWithTemplates = specializations.filter(s => availableSpecs.has(s.id));
  const specsWithout = specializations.filter(s => !availableSpecs.has(s.id));

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
      <SEOHead
        title={`اختر التخصص — ${serviceLabel}`}
        description={`حدد مجال عملك لعرض قوالب ${serviceLabel} المناسبة - مطبعتي، طباعة احترافية في العراق`}
        canonical={`/specializations/${serviceType}`}
      />
      <JsonLd data={breadcrumbSchema([
        { name: 'الرئيسية', url: '/' },
        { name: 'الخدمات', url: '/services' },
        { name: serviceLabel, url: `/specializations/${serviceType}` },
      ])} />
      <div className="container max-w-4xl">
        {!isNativeApp && (
          <Link to={parentId ? `/sub-services/${parentId}` : '/services'} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150">
            <ArrowRight className="w-4 h-4" />
            العودة
          </Link>
        )}

        <div className={`text-center ${isNativeApp ? 'mb-6' : 'mb-12'}`}>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">
            اختر التخصص
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            {serviceLabel} — حدد مجال عملك لعرض القوالب المناسبة
          </p>
        </div>

        {isLoading ? (
          <div className={`text-center ${isNativeApp ? 'py-16' : 'py-24'}`}>
            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 animate-pulse">
              <span className="text-xl">📂</span>
            </div>
            <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
            {[...specsWithTemplates, ...specsWithout].map((spec, i) => {
              const hasTemplates = availableSpecs.has(spec.id);
              return (
                <motion.div
                  key={spec.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  {hasTemplates ? (
                    <Link
                      to={`/templates/${serviceType}/${spec.id}`}
                      className="group block bg-card rounded-2xl p-5 sm:p-6 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/60 hover:border-primary/30"
                    >
                      <div className="text-3xl sm:text-4xl mb-3">
                        {spec.icon_url ? <img src={spec.icon_url} alt={spec.label} className="w-12 h-12 mx-auto rounded-lg object-cover" /> : spec.icon}
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-foreground">{spec.label}</h3>
                    </Link>
                  ) : (
                    <div className="block bg-card/50 rounded-2xl p-5 sm:p-6 text-center border border-border/40 opacity-50 cursor-not-allowed">
                      <div className="text-3xl sm:text-4xl mb-3 grayscale">
                        {spec.icon_url ? <img src={spec.icon_url} alt={spec.label} className="w-12 h-12 mx-auto rounded-lg object-cover opacity-50" /> : spec.icon}
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-muted-foreground">{spec.label}</h3>
                      <p className="text-[10px] text-muted-foreground mt-1">قريباً</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpecializationSelection;
