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
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const Index = () => {
  const [popularTemplates, setPopularTemplates] = useState<PopularTemplate[]>([]);

  useEffect(() => {
    const loadPopular = async () => {
      const { data: templates } = await supabase
        .from('templates')
        .select('id, name, description, preview_url, price, service_type');
      if (!templates) return;

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

      withCounts.sort((a, b) => b.order_count - a.order_count);
      setPopularTemplates(withCounts.slice(0, 6));
    };
    loadPopular();
  }, []);

  return (
    <div className="overflow-hidden">
      {/* Best Selling Templates */}
      <section className="section-spacing bg-background">
        <div className="container max-w-5xl">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-semibold mb-5">
              <ShoppingBag className="w-3.5 h-3.5" />
              الأكثر طلباً
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3 tracking-tight">
              القوالب المفضلة لعملائنا
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto leading-relaxed">اختر من بين الأكثر شعبية واطلب مباشرة</p>
          </motion.div>

          {popularTemplates.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-7">
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
                    to={`/template/${template.id}`}
                    className="group block rounded-2xl overflow-hidden border border-border/60 hover:border-primary/20 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 bg-card"
                  >
                    <div className="aspect-[3/4] bg-muted/40 flex items-center justify-center overflow-hidden">
                      {template.preview_url ? (
                        <img src={template.preview_url} alt={template.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Palette className="w-7 h-7 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-4">
                      <p className="font-mono font-bold text-primary text-xs tracking-widest">{template.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <ShoppingBag className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">جاري تحميل القوالب...</p>
            </div>
          )}

          <div className="text-center mt-12">
            <Link to="/services">
              <Button variant="outline" size="lg" className="gap-2">
                عرض جميع الخدمات
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section-spacing bg-muted/30">
        <div className="container max-w-4xl">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3 tracking-tight">كيف يعمل؟</h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">أربع خطوات بسيطة للحصول على تصميمك</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-8">
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
                <div className={`w-14 h-14 rounded-2xl ${s.color} flex items-center justify-center mx-auto mb-4 text-base font-bold transition-all duration-300 group-hover:scale-110 group-hover:shadow-elevated ${s.color === 'bg-cmyk-yellow' ? 'text-foreground' : 'text-primary-foreground'}`}>
                  {s.step}
                </div>
                <h3 className="font-bold text-foreground mb-1.5 text-sm sm:text-base">{s.label}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-spacing bg-background">
        <div className="container max-w-4xl">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3 tracking-tight">لماذا مطبعتي؟</h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">نسهّل عليك عملية التصميم من البداية للنهاية</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-7">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                className="bg-card rounded-2xl p-7 sm:p-8 border border-border/60 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-20px' }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className={`w-12 h-12 rounded-2xl ${f.bg} flex items-center justify-center ${f.color} mx-auto mb-5`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-foreground text-base mb-2">{f.title}</h4>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-spacing bg-secondary">
        <div className="container max-w-3xl text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl sm:text-4xl font-extrabold text-secondary-foreground mb-4 tracking-tight">
              جاهز تبدأ؟
            </h2>
            <p className="text-secondary-foreground/50 text-sm sm:text-base mb-10 max-w-md mx-auto leading-relaxed">
              اطلب تصميمك الآن واحصل عليه بأسرع وقت وبأعلى جودة
            </p>
            <Link to="/services">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 h-14 text-lg shadow-elevated transition-all duration-200 hover:-translate-y-0.5">
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
