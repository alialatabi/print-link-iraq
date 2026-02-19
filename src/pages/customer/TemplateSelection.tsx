import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, TEMPLATE_COLORS, TEMPLATE_ASPECT_RATIOS, SPECIALIZATION_LABELS, ServiceType } from '@/data/mockData';
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
  const { serviceType, specialization } = useParams<{ serviceType: string; specialization?: string }>();
  const [templates, setTemplates] = useState<DbTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const colors = TEMPLATE_COLORS[serviceType as ServiceType] || TEMPLATE_COLORS.business_card;

  useEffect(() => {
    const load = async () => {
      let query = supabase
        .from('templates')
        .select('*')
        .eq('service_type', (serviceType || '') as any);
      
      if (specialization) {
        query = query.contains('specializations', [specialization]);
      }

      const { data } = await query as unknown as { data: DbTemplate[] | null };
      setTemplates(data || []);
      setLoading(false);
    };
    load();
  }, [serviceType, specialization]);

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-5xl">
        <Link to={specialization ? `/specializations/${serviceType}` : '/'} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150">
          <ArrowRight className="w-4 h-4" />
          {specialization ? 'العودة لاختيار التخصص' : 'العودة للرئيسية'}
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">
            {specialization
              ? `قوالب ${SPECIALIZATION_LABELS[specialization] || ''} — ${SERVICE_LABELS[serviceType as ServiceType] || ''}`
              : `اختر قالب ${SERVICE_LABELS[serviceType as ServiceType] || 'التصميم'}`}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">اختر القالب المناسب وسنقوم بتعديله حسب بياناتك</p>
        </div>

        {loading ? (
          <div className="text-center py-24">
            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 animate-pulse">
              <Palette className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {templates.map((template, i) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/template/${template.id}`}
                  className="group block rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/60 hover:border-primary/20"
                >
                  <div className={`bg-gradient-to-br ${colors.bg} flex items-center justify-center overflow-hidden`} style={{ aspectRatio: TEMPLATE_ASPECT_RATIOS[serviceType as ServiceType] || '3/4' }}>
                    {template.preview_url ? (
                      <img src={template.preview_url} alt={template.name} className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Palette className="w-7 h-7 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 bg-card">
                    <p className="font-mono font-bold text-primary text-xs tracking-widest mb-1">{template.id.slice(0, 8).toUpperCase()}</p>
                    {template.price != null && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-success/15 border border-success/20">
                        <span className="text-xs font-extrabold text-success">{template.price.toLocaleString('en-US')}</span>
                        <span className="text-[10px] font-semibold text-success/80">د.ع</span>
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Palette className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">لا توجد قوالب متاحة حالياً لهذه الخدمة</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateSelection;
