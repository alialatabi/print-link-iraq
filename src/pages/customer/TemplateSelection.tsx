import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, TEMPLATE_COLORS, TEMPLATE_ASPECT_RATIOS, ServiceType } from '@/data/mockData';
import { ArrowRight, Palette } from 'lucide-react';

interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  price: number | null;
}

const TemplateSelection = () => {
  const { serviceType } = useParams<{ serviceType: string }>();
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = TEMPLATE_COLORS[serviceType as ServiceType] || TEMPLATE_COLORS.business_card;

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('service_type', (serviceType || '') as any) as unknown as { data: DbTemplate[] | null };
      setTemplates(data || []);
      setLoading(false);
    };
    load();
  }, [serviceType]);

  return (
    <div className="py-8 sm:py-14">
      <div className="container max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-all duration-200">
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Link>

        <div className="text-center mb-10 sm:mb-14">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            اختر قالب {SERVICE_LABELS[serviceType as ServiceType] || 'التصميم'}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">اختر القالب المناسب وسنقوم بتعديله حسب بياناتك</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 animate-pulse">
              <Palette className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {templates.map((template, i) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to={`/template/${template.id}`}
                  className={`group block rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-border/60 hover:border-primary/30`}
                >
                  <div className={`bg-gradient-to-br ${colors.bg} flex items-center justify-center overflow-hidden`} style={{ aspectRatio: TEMPLATE_ASPECT_RATIOS[serviceType as ServiceType] || '3/4' }}>
                    {template.preview_url ? (
                      <img src={template.preview_url} alt={template.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Palette className="w-7 h-7 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-card">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-foreground text-sm truncate">{template.name}</h4>
                      {template.price != null && (
                        <span className="text-xs font-bold text-primary whitespace-nowrap">{template.price.toLocaleString('ar-IQ')} د.ع</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs mt-1 line-clamp-1">{template.description}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Palette className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-base">لا توجد قوالب متاحة حالياً لهذه الخدمة</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateSelection;
