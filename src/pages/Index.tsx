import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Printer, ArrowLeft, CreditCard, FileText, Receipt, 
  CheckCircle, Upload, Palette, Truck, Star, Users, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  business_card: <CreditCard className="w-10 h-10" />,
  flyer: <FileText className="w-10 h-10" />,
  receipt: <Receipt className="w-10 h-10" />,
  letterhead: <FileText className="w-10 h-10" />,
  menu: <FileText className="w-10 h-10" />,
  invitation: <FileText className="w-10 h-10" />,
};

const CUSTOMER_STEPS = [
  { icon: <CreditCard className="w-8 h-8" />, label: 'اختر الخدمة' },
  { icon: <Palette className="w-8 h-8" />, label: 'حدد التصميم' },
  { icon: <FileText className="w-8 h-8" />, label: 'أدخل التفاصيل' },
  { icon: <CheckCircle className="w-8 h-8" />, label: 'استلم التصميم' },
];

const DESIGNER_STEPS = [
  { icon: <FileText className="w-8 h-8" />, label: 'استلم الطلب' },
  { icon: <Palette className="w-8 h-8" />, label: 'صمم ورفع التصميم' },
  { icon: <Upload className="w-8 h-8" />, label: 'ارسل للعميل' },
  { icon: <CheckCircle className="w-8 h-8" />, label: 'موافقة وطباعة' },
];

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Split Section */}
      <section className="relative">
        <div className="grid md:grid-cols-2 min-h-[500px] md:min-h-[550px]">
          {/* Customer Side */}
          <div className="hero-customer flex flex-col items-center justify-center p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-primary-foreground/20 blur-3xl" />
              <div className="absolute bottom-10 left-10 w-40 h-40 rounded-full bg-accent/20 blur-3xl" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative z-10"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">للزبائن</h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-md">
                صمم واطلب مطبوعاتك بسهولة!
              </p>
              <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
                {CUSTOMER_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-14 h-14 rounded-xl bg-primary-foreground/15 flex items-center justify-center text-primary-foreground">
                      {step.icon}
                    </div>
                    <span className="text-primary-foreground/80 text-sm hidden md:block">{step.label}</span>
                    {i < CUSTOMER_STEPS.length - 1 && (
                      <ArrowLeft className="w-4 h-4 text-primary-foreground/40 hidden md:block" />
                    )}
                  </div>
                ))}
              </div>
              <Link to="/services">
                <Button size="lg" className="bg-success hover:bg-success/90 text-success-foreground text-lg px-8 py-6 rounded-xl shadow-lg">
                  إبدأ طلبك الآن
                </Button>
              </Link>
            </motion.div>
          </div>

          {/* Divider */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center shadow-lg border-2 border-border">
              <span className="text-foreground font-bold text-lg">أو</span>
            </div>
          </div>

          {/* Designer Side */}
          <div className="hero-designer flex flex-col items-center justify-center p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-accent/30 blur-3xl" />
              <div className="absolute bottom-20 right-10 w-40 h-40 rounded-full bg-primary-foreground/10 blur-3xl" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative z-10"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">للمصممين</h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-md">
                احصل على طلبات تصميم جديدة!
              </p>
              <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
                {DESIGNER_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-14 h-14 rounded-xl bg-primary-foreground/10 flex items-center justify-center text-primary-foreground">
                      {step.icon}
                    </div>
                    <span className="text-primary-foreground/70 text-sm hidden md:block">{step.label}</span>
                    {i < DESIGNER_STEPS.length - 1 && (
                      <ArrowLeft className="w-4 h-4 text-primary-foreground/30 hidden md:block" />
                    )}
                  </div>
                ))}
              </div>
              <Link to="/designer/login">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6 rounded-xl shadow-lg">
                  تسجيل كمصمم
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tagline Section */}
      <section className="py-16 bg-background">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              حلقة الوصل بين الزبون والمصمم
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              اطلب تصميمك اليوم واحصل على تصميم احترافي جاهز للطباعة
            </p>
          </motion.div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-16 bg-muted/50">
        <div className="container">
          <h3 className="text-2xl font-bold text-foreground text-center mb-10">خدماتنا</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
            {SERVICES.map((service, i) => (
              <motion.div
                key={service.type}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link
                  to={`/templates/${service.type}`}
                  className="block bg-card rounded-xl p-6 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border"
                >
                  <div className="text-4xl mb-3">{service.icon}</div>
                  <h4 className="font-bold text-foreground mb-1">{SERVICE_LABELS[service.type]}</h4>
                  <p className="text-muted-foreground text-sm">{service.description}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-background">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: <Zap className="w-8 h-8" />, title: 'سرعة في التنفيذ', desc: 'احصل على تصميمك خلال ساعات' },
              { icon: <Star className="w-8 h-8" />, title: 'جودة احترافية', desc: 'مصممون محترفون بخبرة عالية' },
              { icon: <Users className="w-8 h-8" />, title: 'خدمة متميزة', desc: 'تواصل مباشر مع المصمم' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center p-6"
              >
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground mx-auto mb-4">
                  {f.icon}
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">{f.title}</h4>
                <p className="text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
