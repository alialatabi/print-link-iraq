import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useServices, useSpecializations, buildLabelMap } from '@/hooks/useServices';
import { ArrowRight } from 'lucide-react';

const SpecializationSelection = () => {
  const { serviceType } = useParams<{ serviceType: string }>();
  const { services } = useServices();
  const { specializations, loading: specsLoading } = useSpecializations();
  const [availableSpecs, setAvailableSpecs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const serviceLabel = services.find(s => s.id === serviceType)?.label || 'التصميم';

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('templates')
        .select('specialization')
        .eq('service_type', (serviceType || '') as any);

      const specs = new Set<string>();
      if (data) {
        for (const row of data) {
          if ((row as any).specialization) specs.add((row as any).specialization);
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
    <div className="section-spacing-sm">
      <div className="container max-w-4xl">
        <Link to="/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150">
          <ArrowRight className="w-4 h-4" />
          العودة لاختيار الخدمة
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">
            اختر التخصص
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            {serviceLabel} — حدد مجال عملك لعرض القوالب المناسبة
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-24">
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
                      <div className="text-3xl sm:text-4xl mb-3">{spec.icon}</div>
                      <h3 className="font-bold text-sm sm:text-base text-foreground">{spec.label}</h3>
                    </Link>
                  ) : (
                    <div className="block bg-card/50 rounded-2xl p-5 sm:p-6 text-center border border-border/40 opacity-50 cursor-not-allowed">
                      <div className="text-3xl sm:text-4xl mb-3 grayscale">{spec.icon}</div>
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
