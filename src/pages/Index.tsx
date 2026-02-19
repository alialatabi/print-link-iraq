import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, FileText, Receipt, Zap, Star, Users,
  ArrowLeft, CheckCircle, Palette, Truck, Upload, ShoppingBag, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface ServiceCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  link: string;
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'business_card',
    label: 'كروت شخصية',
    description: 'تصميم احترافي يعبر عن هويتك',
    icon: <CreditCard className="w-8 h-8" />,
    gradient: 'from-primary/20 via-primary/10 to-transparent',
    iconBg: 'bg-primary/15 text-primary',
    link: '/services',
  },
  {
    id: 'flyer',
    label: 'فلايرات إعلانية',
    description: 'جذب انتباه عملائك بتصاميم مميزة',
    icon: <FileText className="w-8 h-8" />,
    gradient: 'from-cmyk-magenta/20 via-cmyk-magenta/10 to-transparent',
    iconBg: 'bg-cmyk-magenta/15 text-cmyk-magenta',
    link: '/services',
  },
  {
    id: 'receipt',
    label: 'وصولات & فواتير',
    description: 'وصولات رسمية لمعاملاتك التجارية',
    icon: <Receipt className="w-8 h-8" />,
    gradient: 'from-accent/20 via-accent/10 to-transparent',
    iconBg: 'bg-accent/20 text-accent-foreground',
    link: '/services',
  },
  {
    id: 'letterhead',
    label: 'ترويسة رسمية',
    description: 'ورق رسمي يعكس مهنيتك',
    icon: <FileText className="w-8 h-8" />,
    gradient: 'from-cmyk-cyan/20 via-cmyk-cyan/10 to-transparent',
    iconBg: 'bg-cmyk-cyan/15 text-cmyk-cyan',
    link: '/services',
  },
  {
    id: 'menu',
    label: 'قوائم طعام',
    description: 'منيو أنيق لمطعمك أو مقهاك',
    icon: <ShoppingBag className="w-8 h-8" />,
    gradient: 'from-success/20 via-success/10 to-transparent',
    iconBg: 'bg-success/15 text-success',
    link: '/services',
  },
  {
    id: 'invitation',
    label: 'بطاقات دعوة',
    description: 'دعوات مميزة لمناسباتك الخاصة',
    icon: <Palette className="w-8 h-8" />,
    gradient: 'from-cmyk-magenta/15 via-primary/10 to-transparent',
    iconBg: 'bg-cmyk-magenta/10 text-cmyk-magenta',
    link: '/services',
  },
];

const SERVICE_LABELS: Record<string, string> = {
  business_card: 'كروت شخصية',
  flyer: 'فلايرات',
  receipt: 'وصولات',
  letterhead: 'ترويسة',
  menu: 'قوائم طعام',
  invitation: 'دعوات',
};

const SERVICE_COLORS: Record<string, string> = {
  business_card: 'bg-primary/10 text-primary',
  flyer: 'bg-cmyk-magenta/10 text-cmyk-magenta',
  receipt: 'bg-accent/20 text-accent-foreground',
  letterhead: 'bg-cmyk-cyan/10 text-cmyk-cyan',
  menu: 'bg-success/10 text-success',
  invitation: 'bg-cmyk-magenta/10 text-cmyk-magenta',
};

const FEATURES = [
  { icon: Zap, title: 'سرعة في التنفيذ', desc: 'تصميمك جاهز خلال ساعات قليلة مع متابعة لحظية', color: 'text-primary', bg: 'bg-primary/10' },
  { icon: Star, title: 'جودة احترافية', desc: 'مصممون ذوي خبرة عالية يعملون على طلبك بإتقان', color: 'text-cmyk-magenta', bg: 'bg-cmyk-magenta/10' },
  { icon: Users, title: 'تواصل مباشر', desc: 'تابع حالة طلبك وتواصل مع المصمم بسهولة', color: 'text-accent-foreground', bg: 'bg-accent/20' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const Index = () => {
  const [popularTemplates, setPopularTemplates] = useState<PopularTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPopular = async () => {
      setLoading(true);
      const { data: templates } = await supabase
        .from('templates')
        .select('id, name, description, preview_url, price, service_type');
      if (!templates) { setLoading(false); return; }

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
      setPopularTemplates(withCounts.slice(0, 8));
      setLoading(false);
    };
    loadPopular();
  }, []);

  return (
    <div className="overflow-hidden">

      {/* ─── Hero Banner ─── */}
      <section className="bg-gradient-to-bl from-secondary via-secondary to-secondary/90 text-secondary-foreground py-14 sm:py-20">
        <div className="container max-w-5xl">
          <motion.div
            className="flex flex-col sm:flex-row items-center gap-10"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <div className="flex-1 text-center sm:text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-bold mb-5">
                <Zap className="w-3.5 h-3.5" />
                طباعة احترافية بضغطة زر
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-4 tracking-tight">
                اطبع تصميمك
                <span className="text-primary"> باحترافية</span>
                <br />
                من أي مكان
              </h1>
              <p className="text-secondary-foreground/60 text-sm sm:text-base leading-relaxed max-w-md mx-auto sm:mx-0 mb-8">
                اختر من مئات القوالب الجاهزة أو ارفع تصميمك الخاص، وسنتولى الطباعة والتوصيل
              </p>
              <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
                <Link to="/services">
                  <Button size="lg" className="gap-2 h-12 px-8 text-base">
                    ابدأ طلبك الآن
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/upload-design">
                  <Button size="lg" variant="outline" className="gap-2 h-12 px-8 text-base border-secondary-foreground/20 bg-secondary-foreground/5 text-secondary-foreground hover:bg-secondary-foreground/10">
                    <Upload className="w-4 h-4" />
                    ارفع تصميمك
                  </Button>
                </Link>
              </div>
            </div>
            {/* Stats */}
            <div className="flex sm:flex-col gap-4">
              {[
                { val: '+٥٠٠', label: 'قالب جاهز' },
                { val: '+١٠٠٠', label: 'طلب منجز' },
                { val: '٢٤س', label: 'وقت التنفيذ' },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  className="bg-secondary-foreground/8 border border-secondary-foreground/10 rounded-2xl px-5 py-4 text-center"
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  custom={i + 2}
                >
                  <div className="text-2xl font-extrabold text-primary">{s.val}</div>
                  <div className="text-xs text-secondary-foreground/60 mt-0.5">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Service Categories ─── */}
      <section className="py-10 bg-muted/30 border-b border-border/50">
        <div className="container max-w-5xl">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
            {SERVICE_CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i}
              >
                <Link
                  to={cat.link}
                  className="group flex flex-col items-center gap-2.5 p-3 sm:p-4 rounded-2xl bg-card border border-border/60 hover:border-primary/30 hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 text-center"
                >
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center ${cat.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                    {cat.icon}
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-foreground leading-tight">{cat.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Upload Banner ─── */}
      <section className="py-5 bg-primary/5 border-b border-primary/10">
        <div className="container max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-primary-foreground" />
              </div>
              <p className="text-sm text-foreground font-medium">
                <span className="font-bold">عندك تصميم جاهز؟</span>
                <span className="text-muted-foreground mr-2">ارفع ملفك (PNG, PDF, PSD) وسنرسله للطباعة مباشرة</span>
              </p>
            </div>
            <Link to="/upload-design">
              <Button size="sm" className="gap-1.5 flex-shrink-0">
                <Upload className="w-3.5 h-3.5" />
                ارفع الآن
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Popular Templates Grid ─── */}
      <section className="py-14 sm:py-20 bg-background">
        <div className="container max-w-5xl">
          {/* Header */}
          <motion.div
            className="flex items-end justify-between mb-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/8 text-primary text-xs font-bold mb-3">
                <ShoppingBag className="w-3.5 h-3.5" />
                الأكثر طلباً
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                القوالب المفضلة
              </h2>
            </div>
            <Link to="/services" className="flex items-center gap-1.5 text-primary text-sm font-semibold hover:gap-2.5 transition-all duration-200">
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-muted/60 animate-pulse">
                  <div className="aspect-[3/4]" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : popularTemplates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {popularTemplates.map((template, i) => (
                <motion.div
                  key={template.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-20px' }}
                  variants={scaleIn}
                  custom={i}
                >
                  <Link
                    to={`/template/${template.id}`}
                    className="group block rounded-2xl overflow-hidden border border-border/60 hover:border-primary/25 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 bg-card"
                  >
                    {/* Image */}
                    <div className="relative aspect-[3/4] bg-muted/40 overflow-hidden">
                      {template.preview_url ? (
                        <img
                          src={template.preview_url}
                          alt={template.name}
                          className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
                          <Palette className="w-10 h-10 text-muted-foreground/40" />
                        </div>
                      )}
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/8 transition-colors duration-300" />
                      {/* Badge: most popular */}
                      {i === 0 && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            الأكثر طلباً
                          </span>
                        </div>
                      )}
                      {template.order_count > 0 && i > 0 && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 text-secondary-foreground text-[10px] font-semibold backdrop-blur-sm">
                            {template.order_count}+ طلب
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-1">
                          {template.name}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${SERVICE_COLORS[template.service_type] || 'bg-muted text-muted-foreground'}`}>
                          {SERVICE_LABELS[template.service_type] || template.service_type}
                        </span>
                        {template.price && (
                          <span className="text-sm font-bold text-primary">
                            {template.price.toLocaleString('ar-IQ')} د.ع
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">لا توجد قوالب بعد</p>
            </div>
          )}

          <div className="text-center mt-10">
            <Link to="/services">
              <Button variant="outline" size="lg" className="gap-2">
                عرض جميع الخدمات والقوالب
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="py-14 sm:py-20 bg-muted/30">
        <div className="container max-w-4xl">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">كيف يعمل؟</h2>
            <p className="text-muted-foreground text-sm sm:text-base">أربع خطوات بسيطة للحصول على تصميمك</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              { step: '١', label: 'اختر الخدمة', desc: 'اختر نوع المطبوعة', icon: CheckCircle, color: 'bg-primary text-primary-foreground' },
              { step: '٢', label: 'حدد القالب', desc: 'من تصاميم احترافية', icon: Palette, color: 'bg-cmyk-magenta text-white' },
              { step: '٣', label: 'أدخل بياناتك', desc: 'أضف معلوماتك', icon: FileText, color: 'bg-accent text-accent-foreground' },
              { step: '٤', label: 'استلم تصميمك', desc: 'راجع وافق أو عدّل', icon: Truck, color: 'bg-cmyk-key text-secondary-foreground' },
            ].map((s, i) => (
              <motion.div
                key={i}
                className="text-center group"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-30px' }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className={`w-14 h-14 rounded-2xl ${s.color} flex items-center justify-center mx-auto mb-4 text-xl font-extrabold group-hover:scale-110 group-hover:shadow-elevated transition-all duration-300`}>
                  {s.step}
                </div>
                <h3 className="font-bold text-foreground text-sm sm:text-base mb-1">{s.label}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="py-14 sm:py-20 bg-background">
        <div className="container max-w-4xl">
          <motion.div
            className="text-center mb-12"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">لماذا مطبعتي؟</h2>
            <p className="text-muted-foreground text-sm sm:text-base">نسهّل عليك عملية التصميم من البداية للنهاية</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                className="bg-card rounded-2xl p-7 border border-border/60 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1"
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

      {/* ─── CTA ─── */}
      <section className="py-14 sm:py-20 bg-secondary">
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
              <Button size="lg" className="px-10 h-14 text-lg shadow-elevated transition-all duration-200 hover:-translate-y-0.5">
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
