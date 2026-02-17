import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, TEMPLATE_COLORS, ServiceType } from '@/data/mockData';
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
    <div className="py-12">
      <div className="container max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">
            اختر قالب {SERVICE_LABELS[serviceType as ServiceType] || 'التصميم'}
          </h1>
          <p className="text-muted-foreground">اختر القالب المناسب وسنقوم بتعديله حسب بياناتك</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">جاري التحميل...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {templates.map((template, i) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={`/order/${template.id}`}
                  className={`group block rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border ${colors.accent}`}
                >
                  <div className={`aspect-[3/4] bg-gradient-to-br ${colors.bg} flex items-center justify-center overflow-hidden`}>
                    {template.preview_url ? (
                      <img src={template.preview_url} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Palette className="w-8 h-8 text-primary" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-card">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-foreground text-sm truncate">{template.name}</h4>
                      {template.price != null && (
                        <span className="text-xs font-bold text-primary whitespace-nowrap">{template.price.toLocaleString('ar-IQ')} د.ع</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">{template.description}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div className="text-center py-20">
            <Palette className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">لا توجد قوالب متاحة حالياً لهذه الخدمة</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateSelection;
