import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  CreditCard, FileText, Receipt, Zap, Star, Users,
  ArrowLeft, CheckCircle, Palette, Truck, Upload, ShoppingBag,
  ChevronLeft, Shield, Clock, RefreshCw, Home, Printer, Sparkles, Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import SEOHead from '@/components/SEOHead';
import JsonLd, { localBusinessSchema, websiteSchema, organizationSchema } from '@/components/JsonLd';

interface PopularTemplate {
  id: string;
  name: string;
  description: string | null;
  preview_url: string | null;
  service_type: string;
  order_count: number;
}

interface DBService {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  sort_order: number;
}

const ICON_BG_COLORS = [
  'bg-primary/12 text-primary',
  'bg-cmyk-magenta/12 text-cmyk-magenta',
  'bg-accent/20 text-accent-foreground',
  'bg-cmyk-cyan/12 text-cmyk-cyan',
  'bg-success/12 text-success',
  'bg-cmyk-magenta/10 text-cmyk-magenta',
];

const SERVICE_LABELS: Record<string, string> = {
  business_card: 'كروت شخصية', flyer: 'فلايرات', receipt: 'وصولات',
  letterhead: 'ترويسة', menu: 'قوائم طعام', invitation: 'دعوات',
};

const SERVICE_COLORS: Record<string, string> = {
  business_card: 'bg-primary/10 text-primary', flyer: 'bg-cmyk-magenta/10 text-cmyk-magenta',
  receipt: 'bg-accent/20 text-accent-foreground', letterhead: 'bg-cmyk-cyan/10 text-cmyk-cyan',
  menu: 'bg-success/10 text-success', invitation: 'bg-cmyk-magenta/10 text-cmyk-magenta',
};

const TRUST_ITEMS = [
  { icon: Edit3, text: 'خصّص تصميمك بالكامل' },
  { icon: Printer, text: 'طباعة عالية الجودة' },
  { icon: RefreshCw, text: 'مراجعة مجانية قبل الطباعة' },
  { icon: Home, text: 'توصيل لكل العراق' },
];

const VALUE_PROPS = [
  { icon: Palette, text: 'تصميم مباشر وبأعلى جودة' },
  { icon: Star, text: 'قوالب جاهزة احترافية' },
  { icon: Printer, text: 'طباعة عالية الجودة' },
  { icon: Zap, text: 'سرعة في الإنجاز' },
  { icon: Truck, text: 'توصيل لكل العراق' },
  { icon: Shield, text: 'دعم سريع وموثوق' },
];

const DESIGNER_COLORS = ['bg-primary', 'bg-cmyk-magenta', 'bg-cmyk-cyan', 'bg-success', 'bg-accent'];

const PRINTED_WORKS = [
  { label: 'كرت شخصي فاخر', type: 'business_card', bg: 'from-primary/20 to-primary/5' },
  { label: 'فلاير مطعم', type: 'flyer', bg: 'from-cmyk-magenta/20 to-cmyk-magenta/5' },
  { label: 'منيو مقهى', type: 'menu', bg: 'from-cmyk-cyan/20 to-cmyk-cyan/5' },
  { label: 'بطاقة دعوة', type: 'invitation', bg: 'from-success/20 to-success/5' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, scale: 1,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const Index = () => {
  const { role } = useAuth();
  const [popularTemplates, setPopularTemplates] = useState<PopularTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [parentServices, setParentServices] = useState<DBService[]>([]);
  const [realDesigners, setRealDesigners] = useState<{ name: string; initials: string; color: string; completedOrders: number }[]>([]);

  useEffect(() => {
    const loadServices = async () => {
      const { data } = await supabase
        .from('services')
        .select('id, label, icon, icon_url, sort_order')
        .is('parent_id', null)
        .order('sort_order');
      if (data) setParentServices(data);
    };
    loadServices();
    const loadPopular = async () => {
      setLoading(true);
      const { data: templates } = await supabase
        .from('templates')
        .select('id, name, description, preview_url, service_type');
      if (!templates) { setLoading(false); return; }
      const { data: orders } = await supabase.from('orders').select('template_id');
      const countMap: Record<string, number> = {};
      (orders || []).forEach((o: any) => {
        if (o.template_id) countMap[o.template_id] = (countMap[o.template_id] || 0) + 1;
      });
      const withCounts = templates.map(t => ({ ...t, order_count: countMap[t.id] || 0 }));
      withCounts.sort((a, b) => b.order_count - a.order_count);
      setPopularTemplates(withCounts.slice(0, 8));
      setLoading(false);
    };
    loadPopular();

    const loadDesigners = async () => {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'designer');
      if (!roleData || roleData.length === 0) return;
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, is_active')
        .in('user_id', userIds);
      if (!profiles) return;
      const activeDesigners = profiles.filter(p => p.is_active !== false);
      const { data: orders } = await supabase
        .from('orders')
        .select('designer_id')
        .in('designer_id', userIds)
        .in('status', ['approved', 'print_ready', 'printed', 'delivered']);
      const countMap: Record<string, number> = {};
      (orders || []).forEach((o: any) => {
        if (o.designer_id) countMap[o.designer_id] = (countMap[o.designer_id] || 0) + 1;
      });
      setRealDesigners(activeDesigners.map((d, i) => {
        const name = d.display_name || 'مصمم';
        const words = name.split(' ');
        const initials = words.length >= 2
          ? words[0][0] + words[1][0]
          : name.slice(0, 2);
        return {
          name,
          initials,
          color: DESIGNER_COLORS[i % DESIGNER_COLORS.length],
          completedOrders: countMap[d.user_id] || 0,
        };
      }));
    };
    loadDesigners();
  }, []);

  if (role === 'designer') {
    return <Navigate to="/designer/orders" replace />;
  }

  return (
    <div className="overflow-hidden">
      <SEOHead
        title="خدمات طباعة احترافية في العراق"
        description="مطبعتي - خدمات طباعة أونلاين في العراق. كروت شخصية، فلايرات، وصولات، ترويسة، قوائم طعام، ودعوات. اختر قالباً، خصّصه، واستلمه لباب بيتك."
        canonical="/"
      />
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={organizationSchema} />
      {/* ─── Hero ─── */}
      <section className="relative bg-gradient-to-bl from-background via-muted/40 to-muted/60 dark:from-[hsl(222,47%,4%)] dark:via-[hsl(222,47%,6%)] dark:to-[hsl(222,47%,8%)] text-foreground dark:text-secondary-foreground pt-12 pb-16 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* subtle bg pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        {/* decorative blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 right-0 w-72 h-72 rounded-full bg-cmyk-cyan/15 blur-3xl pointer-events-none" />
        {/* Extra glow for dark mode depth */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[100px] pointer-events-none hidden dark:block" />

        <div className="container max-w-6xl relative">
          <div className="flex flex-col sm:flex-row items-center gap-12 sm:gap-16">

            {/* Text */}
            <motion.div className="flex-1 text-center sm:text-right" initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              {/* Customization badge */}
              <motion.div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/20 text-accent-foreground dark:text-accent text-xs font-bold mb-5 border border-accent/30 shadow-sm" initial="hidden" animate="visible" variants={fadeUp} custom={0}>
                <Sparkles className="w-3.5 h-3.5" />
                اختر — خصّص — اطبع — استلم
              </motion.div>

              <motion.h1 className="font-noor text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.15] mb-3 tracking-tight" initial="hidden" animate="visible" variants={fadeUp} custom={1}>
                <span className="text-primary">خصّص</span> تصميمك
                <br />
                واطبعه <span className="relative inline-block">بلحظة
                  <span className="absolute -bottom-1 right-0 left-0 h-1 bg-accent/60 rounded-full" />
                </span>
              </motion.h1>

              <motion.p className="text-muted-foreground dark:text-secondary-foreground/60 text-sm sm:text-base leading-relaxed max-w-md mx-auto sm:mx-0 mb-8" initial="hidden" animate="visible" variants={fadeUp} custom={2}>
                اختر قالباً جاهزاً، أضف بياناتك، وسنطبعه ونوصله لباب بيتك — كل شي أونلاين.
              </motion.p>

              <motion.div className="flex flex-wrap gap-3 justify-center sm:justify-start" initial="hidden" animate="visible" variants={fadeUp} custom={3}>
                <Link to="/services">
                  <Button size="lg" className="gap-2 h-13 px-10 text-base animate-cta-glow bg-accent text-accent-foreground hover:bg-accent/90 hover:-translate-y-0.5 transition-transform font-extrabold shadow-brand">
                    <Palette className="w-4 h-4" />
                    ابدأ التخصيص الآن
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/upload-design">
                  <Button size="lg" variant="outline" className="gap-2 h-13 px-8 text-base border-border bg-muted/60 text-foreground hover:bg-muted dark:border-secondary-foreground/20 dark:bg-secondary-foreground/5 dark:text-secondary-foreground dark:hover:bg-secondary-foreground/10">
                    <Upload className="w-4 h-4" />
                    ارفع تصميمك
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Stats panel */}
            <motion.div
              className="grid grid-cols-3 sm:flex sm:flex-col gap-3 sm:gap-4 w-full sm:w-auto"
              initial="hidden" animate="visible" variants={fadeUp} custom={2}
            >
              {[
                { val: '+٥٠٠', label: 'قالب قابل للتخصيص', icon: Palette, color: 'text-primary', bg: 'bg-primary/15' },
                { val: '+١٠٠٠', label: 'تصميم مخصص مُنجز', icon: CheckCircle, color: 'text-success', bg: 'bg-success/15' },
                { val: '٧٢ س', label: 'وقت التسليم', icon: Clock, color: 'text-cmyk-cyan', bg: 'bg-cmyk-cyan/15' },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  className="flex flex-col items-center sm:items-start gap-2 bg-card/80 border border-border/60 dark:bg-[hsl(222,47%,10%)] dark:border-[hsl(217,33%,18%)] rounded-2xl px-3 py-4 sm:px-6 sm:py-5 sm:min-w-[160px] sm:flex-row hover:bg-muted/80 dark:hover:bg-[hsl(222,47%,12%)] transition-colors duration-200 shadow-card dark:shadow-dark-card"
                  initial="hidden" animate="visible" variants={fadeUp} custom={i + 3}
                >
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                    <s.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${s.color}`} />
                  </div>
                  <div className="text-center sm:text-right">
                    <div className={`text-xl sm:text-3xl font-extrabold ${s.color} leading-none`}>{s.val}</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 font-medium">{s.label}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>


      {/* ─── Upload Banner ─── */}
      <section className="py-5 bg-gradient-to-l from-primary/15 via-cmyk-magenta/10 to-primary/15 dark:from-primary/10 dark:via-cmyk-magenta/8 dark:to-primary/10 border-y border-primary/20">
        <div className="container max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/80 dark:bg-[hsl(222,47%,9%)]/90 backdrop-blur-sm rounded-2xl px-5 py-4 border border-primary/25 shadow-elevated dark:shadow-dark-elevated">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-cmyk-cyan flex items-center justify-center flex-shrink-0 shadow-md">
                <Upload className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-extrabold text-foreground">
                  عندك تصميم جاهز؟
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ارفع ملفك (PNG, PDF, PSD) وسنرسله للطباعة مباشرة
                </p>
              </div>
            </div>
            <Link to="/upload-design">
              <Button size="default" className="gap-2 flex-shrink-0 bg-gradient-to-l from-primary to-cmyk-cyan hover:opacity-90 shadow-md px-6">
                <Upload className="w-4 h-4" />
                ارفع الآن
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Trust Block ─── */}
      <section className="py-10 bg-card dark:bg-[hsl(222,47%,7%)] border-b border-border/40">
        <div className="container max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TRUST_ITEMS.map((item, i) => (
              <motion.div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 dark:bg-[hsl(222,47%,10%)] border border-border/50 dark:border-[hsl(217,33%,16%)] dark:shadow-dark-card" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-foreground leading-snug">
                  <span className="text-primary font-bold ml-1">✓</span>
                  {item.text}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Popular Templates Grid ─── */}
      <section className="py-16 sm:py-24 bg-background">
        <div className="container max-w-5xl">
          <motion.div className="flex items-end justify-between mb-8" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={0}>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                قوالب قابلة للتخصيص
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">اختر قالبك وخصّصه بالكامل</h2>
              <p className="text-muted-foreground text-sm mt-1">اختر المنتج — أدخل بياناتك — نصممه ونطبعه لك</p>
            </div>
            <Link to="/services" className="flex items-center gap-1.5 text-primary text-sm font-semibold hover:gap-2.5 transition-all duration-200">
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-muted/60 animate-pulse">
                  <div className="aspect-[3/4]" />
                  <div className="p-3 space-y-2"><div className="h-3 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-1/2" /></div>
                </div>
              ))}
            </div>
          ) : popularTemplates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {popularTemplates.map((template, i) => (
                <motion.div key={template.id} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-20px' }} variants={scaleIn} custom={i}>
                  <Link to={`/template/${template.id}`} className="group block rounded-2xl overflow-hidden border border-border/40 dark:border-[hsl(217,33%,16%)] hover:border-primary/30 shadow-card dark:shadow-dark-card hover:shadow-card-hover dark:hover:shadow-dark-card-hover transition-all duration-400 hover:-translate-y-2 bg-card/80 dark:bg-[hsl(222,47%,9%)] backdrop-blur-sm">
                    {/* Image */}
                    <div className="relative aspect-[3/4] bg-muted/40 overflow-hidden">
                      {template.preview_url ? (
                        <>
                          <img src={template.preview_url} alt={template.name} className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500" />
                          <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.08)] pointer-events-none" />
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/60">
                          <Palette className="w-10 h-10 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/8 transition-colors duration-300" />
                      
                      {/* "Customize" badge on every card */}
                      <div className="absolute bottom-2.5 left-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-md backdrop-blur-sm">
                          <Edit3 className="w-2.5 h-2.5" />
                          خصّص الآن
                        </span>
                      </div>

                      {i === 0 && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-sm">
                            <Star className="w-2.5 h-2.5 fill-current" /> الأكثر طلباً
                          </span>
                        </div>
                      )}
                      {template.order_count > 0 && i > 0 && (
                        <div className="absolute top-2.5 right-2.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 dark:bg-[hsl(222,47%,14%)] text-secondary-foreground text-[10px] font-semibold backdrop-blur-sm">
                            {template.order_count}+ طلب
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 sm:p-4">
                      <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-1 mb-2">{template.name}</h3>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${SERVICE_COLORS[template.service_type] || 'bg-muted text-muted-foreground'}`}>
                          {SERVICE_LABELS[template.service_type] || template.service_type}
                        </span>
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
              <Button variant="outline" size="lg" className="gap-2 shadow-brand hover:shadow-brand-hover transition-shadow">
                عرض جميع الخدمات والقوالب
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Printed Works (نماذج مطبوعة) ─── */}
      <section className="py-16 sm:py-24 bg-muted/40 dark:bg-[hsl(222,47%,6%)] border-y border-border/40">
        <div className="container max-w-5xl">
          <motion.div className="text-center mb-10" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={0}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold mb-3">
              <Printer className="w-3.5 h-3.5" />
              نتائج حقيقية
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">تصاميم مخصصة ومطبوعة لعملائنا</h2>
            <p className="text-muted-foreground text-sm">كل تصميم بدأ بقالب — تم تخصيصه — ثم طُبع بجودة عالية</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {PRINTED_WORKS.map((work, i) => (
              <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-20px' }} variants={scaleIn} custom={i}>
                <div className="group rounded-2xl overflow-hidden border border-border/60 dark:border-[hsl(217,33%,16%)] hover:border-primary/20 shadow-card dark:shadow-dark-card hover:shadow-card-hover dark:hover:shadow-dark-card-hover transition-all duration-300 hover:-translate-y-1 bg-card dark:bg-[hsl(222,47%,9%)]">
                  <div className={`relative aspect-[3/4] bg-gradient-to-br ${work.bg} flex items-center justify-center overflow-hidden`}>
                    <div className="relative w-[70%] h-[65%] bg-card rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.15),0_2px_8px_rgba(0,0,0,0.08)] rotate-[-2deg] group-hover:rotate-0 transition-transform duration-500 flex items-center justify-center border border-border/30">
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
                      <Palette className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <div className="absolute w-[65%] h-[62%] bg-muted/60 rounded-lg shadow-sm rotate-[3deg] -z-0 border border-border/20" />
                    {/* Customized label */}
                    <div className="absolute bottom-3 left-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/90 text-success-foreground text-[10px] font-bold shadow-sm">
                        <CheckCircle className="w-2.5 h-2.5" /> تم تخصيصه
                      </span>
                    </div>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xs font-bold text-foreground">{work.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">تصميم مخصص + طباعة</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Designer Presence ─── */}
      <section className="py-16 sm:py-24 bg-background">
        <div className="container max-w-4xl">
          <motion.div className="text-center mb-10" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={0}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cmyk-magenta/10 text-cmyk-magenta text-xs font-bold mb-3">
              <Users className="w-3.5 h-3.5" />
              فريق المصممين
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">
              يعمل على تصاميمك مصممون محترفون
            </h2>
            <p className="text-muted-foreground text-sm">كل طلب يُسنَد لمصمم متخصص يضمن أعلى جودة</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {realDesigners.length > 0 ? realDesigners.map((d, i) => (
              <motion.div key={i} className="bg-card dark:bg-[hsl(222,47%,9%)] rounded-2xl p-5 border border-border/60 dark:border-[hsl(217,33%,16%)] text-center shadow-card dark:shadow-dark-card hover:shadow-card-hover dark:hover:shadow-dark-card-hover hover:-translate-y-1 transition-all duration-300" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <div className={`w-14 h-14 rounded-full ${d.color} text-white flex items-center justify-center text-lg font-extrabold mx-auto mb-3 shadow-sm`}>
                  {d.initials}
                </div>
                <p className="font-bold text-foreground text-sm mb-1">{d.name}</p>
                {d.completedOrders > 0 && (
                  <p className="text-muted-foreground text-[11px]">{d.completedOrders}+ تصميم مخصص</p>
                )}
                <div className="mt-3 inline-flex items-center gap-1 text-[10px] text-success font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  متاح للطلبات
                </div>
              </motion.div>
            )) : (
              <div className="col-span-full text-center py-8 text-muted-foreground text-sm">لا يوجد مصممين مسجلين حالياً</div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Value Proposition / لماذا مطبعتي ─── */}
      <section className="py-14 sm:py-20 bg-muted/20 dark:bg-[hsl(222,47%,6%)]">
        <div className="container max-w-4xl">
          <motion.div className="text-center mb-10" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={0}>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground mb-2 tracking-tight">لماذا مطبعتي ؟</h2>
            <p className="text-muted-foreground text-sm sm:text-base">نسهّل عليك عملية التصميم والطباعة من البداية للنهاية</p>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {VALUE_PROPS.map((item, i) => (
              <motion.div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-card dark:bg-[hsl(222,47%,9%)] border border-border/60 dark:border-[hsl(217,33%,16%)] shadow-card dark:shadow-dark-card hover:shadow-card-hover dark:hover:shadow-dark-card-hover hover:-translate-y-0.5 transition-all duration-300" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground leading-snug">
                  <span className="text-primary font-bold ml-1">✓</span>
                  {item.text}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-14 sm:py-20 bg-secondary dark:bg-[hsl(222,47%,4%)] dark:border-t dark:border-[hsl(217,33%,14%)]">
        <div className="container max-w-3xl text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={fadeUp} custom={0}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/20 text-success text-sm font-bold mb-6 border border-success/20">
              <Clock className="w-4 h-4" />
              طباعة وتسليم خلال ٧٢ ساعة لكل أنحاء العراق
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-secondary-foreground mb-4 tracking-tight">
              خصّص تصميمك واطبعه <span className="text-primary">خلال دقيقة</span>
            </h2>
            <p className="text-secondary-foreground/70 text-sm sm:text-base mb-10 max-w-md mx-auto leading-relaxed">
              اختر قالب — أضف بياناتك — نطبعه ونوصله لك
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/services">
                <Button size="lg" className="px-10 h-14 text-lg shadow-brand hover:shadow-brand-hover transition-all duration-200 hover:-translate-y-0.5">
                  <Palette className="w-5 h-5 ml-2" />
                  ابدأ التخصيص
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>
              </Link>
              <Link to="/upload-design">
                <Button size="lg" variant="outline" className="h-14 px-8 text-base border-secondary-foreground/20 bg-secondary-foreground/5 text-secondary-foreground hover:bg-secondary-foreground/10">
                  <Upload className="w-4 h-4 ml-2" />
                  ارفع تصميمك الجاهز
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Sticky Mobile CTA ─── */}
      <div className="fixed bottom-0 right-0 left-0 z-40 sm:hidden px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none">
        <Link to="/services" className="pointer-events-auto block">
          <Button size="lg" className="w-full h-13 text-base gap-2 shadow-elevated">
            <Palette className="w-4 h-4" />
            ابدأ التخصيص الآن
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
