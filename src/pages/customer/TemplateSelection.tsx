import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { TEMPLATE_COLORS, TEMPLATE_ASPECT_RATIOS, ServiceType } from '@/data/mockData';
import { ArrowRight, Palette } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import SEOHead from '@/components/SEOHead';
import JsonLd, { breadcrumbSchema } from '@/components/JsonLd';
import { useServices, useSpecializations } from '@/hooks/useServices';

interface DbTemplate {
  id: string;
  name: string;
  description: string | null;
  service_type: string;
  preview_url: string | null;
  specializations: string[] | null;
}

const TemplateSelection = () => {
  const { serviceType } = useParams<{ serviceType: string }>();
  const { services } = useServices();
  const { specializations, loading: specsLoading } = useSpecializations();
  const [allTemplates, setAllTemplates] = useState<DbTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);
  const colors = TEMPLATE_COLORS[serviceType as ServiceType] || TEMPLATE_COLORS.business_card;

  const currentService = services.find(s => s.id === serviceType);
  const serviceLabel = currentService?.label || 'التصميم';
  const parentId = currentService?.parent_id;

  // Load all templates for this service type
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('service_type', (serviceType || '') as any) as unknown as { data: DbTemplate[] | null };
      setAllTemplates(data || []);
      setLoading(false);
    };
    load();
  }, [serviceType]);

  // Find which specializations have templates in this service
  const availableSpecIds = new Set<string>();
  for (const t of allTemplates) {
    if (Array.isArray(t.specializations)) {
      t.specializations.forEach(s => availableSpecIds.add(s));
    }
  }
  const availableSpecs = specializations.filter(s => availableSpecIds.has(s.id));

  // Filter templates by selected specialization
  const filteredTemplates = selectedSpec
    ? allTemplates.filter(t => Array.isArray(t.specializations) && t.specializations.includes(selectedSpec))
    : allTemplates;

  const selectedSpecLabel = selectedSpec
    ? specializations.find(s => s.id === selectedSpec)?.label || ''
    : '';

  return (
    <div className="section-spacing-sm">
      <SEOHead
        title={selectedSpec
          ? `قوالب ${selectedSpecLabel} — ${serviceLabel}`
          : `قوالب ${serviceLabel}`}
        description={`تصفح قوالب ${serviceLabel} الاحترافية الجاهزة للتخصيص - مطبعتي`}
        canonical={`/templates/${serviceType}`}
      />
      <JsonLd data={breadcrumbSchema([
        { name: 'الرئيسية', url: '/' },
        ...(parentId ? [{ name: services.find(s => s.id === parentId)?.label || '', url: `/sub-services/${parentId}` }] : []),
        { name: serviceLabel, url: `/templates/${serviceType}` },
      ])} />
      <div className="container max-w-5xl">
        <Link
          to={parentId ? `/sub-services/${parentId}` : '/'}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-all duration-150"
        >
          <ArrowRight className="w-4 h-4" />
          العودة
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">
            قوالب {serviceLabel}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">اختر القالب المناسب وسنقوم بتعديله حسب بياناتك</p>
        </div>

        {/* Specialization filter chips */}
        {!specsLoading && availableSpecs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8 justify-center">
            <button
              onClick={() => setSelectedSpec(null)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                !selectedSpec
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
              }`}
            >
              الكل
            </button>
            {availableSpecs.map(spec => (
              <button
                key={spec.id}
                onClick={() => setSelectedSpec(selectedSpec === spec.id ? null : spec.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                  selectedSpec === spec.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                {spec.icon_url ? (
                  <img src={spec.icon_url} alt="" className="w-5 h-5 rounded object-cover" />
                ) : (
                  <span className="text-base">{spec.icon}</span>
                )}
                {spec.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-24">
            <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 animate-pulse">
              <Palette className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">جاري التحميل...</p>
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filteredTemplates.map((template, i) => (
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
                      <div className="flex flex-col items-center justify-center gap-2 p-4">
                        <img src={logoImg} alt="مطبعتي" className="w-16 h-16 object-contain opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 bg-card">
                    <p className="font-mono font-bold text-primary text-xs tracking-widest">{template.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Palette className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              {selectedSpec ? 'لا توجد قوالب لهذا التخصص' : 'لا توجد قوالب متاحة حالياً لهذه الخدمة'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateSelection;
