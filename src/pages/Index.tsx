import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, CreditCard, FileText, Receipt,
  Zap, Star, Users, ArrowLeft, CheckCircle, Palette, Truck, ShoppingBag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';
import type { ServiceType } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';

interface PopularTemplate {
  id: string;
  name: string;
  description: string | null;
  preview_url: string | null;
  price: number | null;
  service_type: string;
  order_count: number;
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  business_card: <CreditCard className="w-7 h-7" />,
  flyer: <FileText className="w-7 h-7" />,
  receipt: <Receipt className="w-7 h-7" />,
  letterhead: <FileText className="w-7 h-7" />,
  menu: <FileText className="w-7 h-7" />,
  invitation: <FileText className="w-7 h-7" />,
};

const STEPS = [
  { step: '١', label: 'اختر الخدمة', desc: 'اختر نوع المطبوعة المطلوبة', icon: CheckCircle, color: 'bg-cmyk-cyan' },
  { step: '٢', label: 'حدد القالب', desc: 'اختر من تصاميم جاهزة واحترافية', icon: Palette, color: 'bg-cmyk-magenta' },
  { step: '٣', label: 'أدخل بياناتك', desc: 'أضف المعلومات التي تريدها على التصميم', icon: FileText, color: 'bg-cmyk-yellow' },
  { step: '٤', label: 'استلم التصميم', desc: 'راجع التصميم ووافق عليه أو اطلب تعديل', icon: Truck, color: 'bg-cmyk-key' },
];

const FEATURES = [
  { icon: Zap, title: 'سرعة في التنفيذ', desc: 'تصميمك جاهز خلال ساعات قليلة مع متابعة لحظية', color: 'text-cmyk-cyan', bg: 'bg-cmyk-cyan/10' },
  { icon: Star, title: 'جودة احترافية', desc: 'مصممون ذوي خبرة عالية يعملون على طلبك بإتقان', color: 'text-cmyk-magenta', bg: 'bg-cmyk-magenta/10' },
  { icon: Users, title: 'تواصل مباشر', desc: 'تابع حالة طلبك وتواصل مع المصمم بسهولة', color: 'text-cmyk-yellow', bg: 'bg-cmyk-yellow/10' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const Index = () => {
  const [popularTemplates, setPopularTemplates] = useState<PopularTemplate[]>([]);

  useEffect(() => {
    const loadPopular = async () => {
      // Get templates with order count
      const { data: templates } = await supabase
        .from('templates')
        .select('id, name, description, preview_url, price, service_type');
      if (!templates) return;

      // Get order counts per template
      const { data: orders } = await supabase
        .from('orders')
        .select('template_id');

      const countMap: Record<string, number> = {};
      (orders || []).forEach((o: any) => {
        if (o.template_id) countMap[o.template_id] = (countMap[o.template_id] || 0) + 1;
      });

      const withCounts = templates.map(t => ({
        ...t,
        order_count: countMap[t.id] || 0,
      }));

      // Sort by order count desc, take top 6
      withCounts.sort((a, b) => b.order_count - a.order_count);
      setPopularTemplates(withCounts.slice(0, 6));
    };
    loadPopular();
  }, []);
  return (
    <div className="overflow-hidden">
      {/* Services - shown immediately */}
      <section className="py-12 bg-background">
        <div className="container max-w-5xl">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">خدماتنا</h1>
            <p className="text-muted-foreground text-lg">اختر من مجموعة واسعة من خدمات التصميم والطباعة</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {SERVICES.map((service, i) => (
              <motion.div
                key={service.type}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to={`/templates/${service.type}`}
                  className="block bg-card rounded-2xl p-6 md:p-8 text-center border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all group hover:-translate-y-1"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    {SERVICE_ICONS[service.type]}
                  </div>
                  <h4 className="font-bold text-foreground mb-2">{SERVICE_LABELS[service.type as ServiceType]}</h4>
                  <p className="text-muted-foreground text-sm leading-relaxed">{service.description}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* Best Selling Templates */}
      <section className="py-20 bg-background">
        <div className="container max-w-5xl">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              <ShoppingBag className="w-8 h-8 inline-block ml-2 text-primary" />
              الأكثر طلباً
            </h2>
            <p className="text-muted-foreground text-lg">القوالب المفضلة لعملائنا — اطلب مباشرة!</p>
          </motion.div>

          {popularTemplates.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {popularTemplates.map((template, i) => (
                <motion.div
                  key={template.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-20px' }}
                  variants={fadeUp}
                  custom={i + 1}
                >
                  <Link
                    to={`/order/${template.id}`}
                    className="group block rounded-2xl overflow-hidden border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all hover:-translate-y-1 bg-card"
                  >
                    <div className="aspect-[3/4] bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center overflow-hidden">
                      {template.preview_url ? (
                        <img src={template.preview_url} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Palette className="w-8 h-8 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-bold text-foreground text-sm truncate">{template.name}</h4>
                        {template.price != null && (
                          <span className="text-xs font-bold text-primary whitespace-nowrap">{template.price.toLocaleString('ar-IQ')} د.ع</span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs mb-2">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{SERVICE_LABELS[template.service_type as ServiceType]}</span>
                        {template.order_count > 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{template.order_count} طلب</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-muted-foreground">جاري تحميل القوالب...</p>
            </div>
          )}

          <div className="text-center mt-8">
            <Link to="/services">
              <Button variant="outline" size="lg" className="rounded-xl px-8">
                عرض جميع الخدمات
                <ArrowLeft className="w-4 h-4 mr-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-4xl">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">كيف يعمل؟</h2>
            <p className="text-muted-foreground text-lg">أربع خطوات بسيطة للحصول على تصميمك</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <motion.div
                key={i}
                className="relative text-center group"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-30px' }}
                variants={fadeUp}
                custom={i + 1}
              >
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 -left-3 w-6 h-0.5 bg-border" />
                )}
                <div className={`w-16 h-16 rounded-2xl ${s.color} flex items-center justify-center mx-auto mb-4 text-lg font-bold transition-transform group-hover:scale-110 ${s.color === 'bg-cmyk-yellow' ? 'text-foreground' : 'text-primary-foreground'}`}>
                  {s.step}
                </div>
                <h3 className="font-bold text-foreground mb-2">{s.label}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-4xl">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">لماذا ترندي؟</h2>
            <p className="text-muted-foreground text-lg">نسهّل عليك عملية التصميم من البداية للنهاية</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                className="bg-card rounded-2xl p-8 border border-border text-center hover:shadow-lg transition-all hover:-translate-y-1"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-20px' }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className={`w-14 h-14 rounded-2xl ${f.bg} flex items-center justify-center ${f.color} mx-auto mb-4`}>
                  <f.icon className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-foreground text-lg mb-2">{f.title}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-secondary">
        <div className="container max-w-3xl text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-secondary-foreground mb-4">
              جاهز تبدأ؟
            </h2>
            <p className="text-secondary-foreground/60 text-lg mb-8 max-w-md mx-auto">
              اطلب تصميمك الآن واحصل عليه بأسرع وقت وبأعلى جودة
            </p>
            <Link to="/services">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-6 text-lg rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:-translate-y-0.5">
                ابدأ الآن
                <ArrowLeft className="w-5 h-5 mr-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Index;
