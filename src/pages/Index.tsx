import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, CreditCard, FileText, Receipt,
  Zap, Star, Users, ArrowLeft, CheckCircle, Palette, Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';
import type { ServiceType } from '@/data/mockData';

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
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative py-24 md:py-36 bg-secondary overflow-hidden">
        {/* Animated CMYK circles background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-cmyk-cyan/10 blur-3xl"
            animate={{ scale: [1, 1.2, 1], x: [0, 20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/2 -left-20 w-64 h-64 rounded-full bg-cmyk-magenta/10 blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], y: [0, -30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-10 right-1/3 w-56 h-56 rounded-full bg-cmyk-yellow/8 blur-3xl"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="container max-w-4xl text-center relative z-10">
          {/* CMYK dots */}
          <motion.div
            className="flex items-center justify-center gap-3 mb-8"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            {['bg-cmyk-cyan', 'bg-cmyk-magenta', 'bg-cmyk-yellow', 'bg-cmyk-key'].map((c, i) => (
              <motion.div
                key={i}
                className={`w-3 h-3 rounded-full ${c}`}
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ delay: i * 0.15, duration: 2, repeat: Infinity }}
              />
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <TrendingUp className="w-10 h-10 text-red-500" />
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-yellow-400">
                ترندي
              </h1>
            </div>
          </motion.div>

          <motion.p
            className="text-secondary-foreground/70 text-lg md:text-xl mb-10 max-w-xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            حلقة الوصل بين الزبون والمصمم — اطلب تصميم مطبوعاتك الاحترافية بخطوات بسيطة وسريعة
          </motion.p>

          <motion.div
            className="flex items-center justify-center gap-4 flex-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Link to="/services">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-6 text-lg rounded-xl shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5">
                ابدأ طلبك الآن
                <ArrowLeft className="w-5 h-5 mr-2" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="border-secondary-foreground/20 text-secondary-foreground hover:bg-secondary-foreground/10 px-8 py-6 text-lg rounded-xl">
                سجّل دخولك
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="flex items-center justify-center gap-8 md:gap-12 mt-14"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            {[
              { value: '٦', label: 'خدمات متنوعة' },
              { value: '٢٤/٧', label: 'تتبع مباشر' },
              { value: '✓', label: 'جودة مضمونة' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</p>
                <p className="text-secondary-foreground/50 text-xs md:text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-background">
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
                {/* Connector line (desktop) */}
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

      {/* Services */}
      <section className="py-20 bg-muted/30">
        <div className="container max-w-5xl">
          <motion.div
            className="text-center mb-14"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">خدماتنا</h2>
            <p className="text-muted-foreground text-lg">اختر من مجموعة واسعة من خدمات التصميم والطباعة</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {SERVICES.map((service, i) => (
              <motion.div
                key={service.type}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-20px' }}
                variants={fadeUp}
                custom={i + 1}
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

      {/* Features */}
      <section className="py-20 bg-background">
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
