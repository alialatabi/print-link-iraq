import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MOCK_TEMPLATES, SERVICE_LABELS, TEMPLATE_COLORS, ServiceType } from '@/data/mockData';
import { ArrowRight, Palette } from 'lucide-react';

const TemplateSelection = () => {
  const { serviceType } = useParams<{ serviceType: string }>();
  const templates = MOCK_TEMPLATES.filter(t => t.service_type === serviceType);
  const colors = TEMPLATE_COLORS[serviceType as ServiceType] || TEMPLATE_COLORS.business_card;

  return (
    <div className="py-12">
      <div className="container max-w-5xl">
        <Link to="/services" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-4 h-4" />
          العودة للخدمات
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-3">
            اختر قالب {SERVICE_LABELS[serviceType as ServiceType] || 'التصميم'}
          </h1>
          <p className="text-muted-foreground">اختر القالب المناسب وسنقوم بتعديله حسب بياناتك</p>
        </div>

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
                <div className={`aspect-[3/4] bg-gradient-to-br ${colors.bg} flex items-center justify-center`}>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Palette className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <div className="p-4 bg-card">
                  <h4 className="font-bold text-foreground text-sm">{template.name}</h4>
                  <p className="text-muted-foreground text-xs mt-1">{template.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {templates.length === 0 && (
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
