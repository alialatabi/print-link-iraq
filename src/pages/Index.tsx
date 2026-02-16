import { Link } from 'react-router-dom';
import { 
  Printer, CreditCard, FileText, Receipt, 
  Zap, Star, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  business_card: <CreditCard className="w-8 h-8" />,
  flyer: <FileText className="w-8 h-8" />,
  receipt: <Receipt className="w-8 h-8" />,
  letterhead: <FileText className="w-8 h-8" />,
  menu: <FileText className="w-8 h-8" />,
  invitation: <FileText className="w-8 h-8" />,
};

const CMYK_DOTS = [
  'bg-cmyk-cyan',
  'bg-cmyk-magenta',
  'bg-cmyk-yellow',
  'bg-cmyk-key',
];

const Index = () => {
  return (
    <div>
      {/* Hero */}
      <section className="py-20 md:py-28 bg-secondary text-secondary-foreground">
        <div className="container max-w-3xl text-center">
          {/* CMYK dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {CMYK_DOTS.map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${c}`} />
            ))}
          </div>

          <Printer className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Print<span className="text-cmyk-magenta">Link</span>
          </h1>
          <p className="text-secondary-foreground/70 text-lg mb-8 max-w-lg mx-auto">
            حلقة الوصل بين الزبون والمصمم — اطلب تصميم مطبوعاتك بخطوات بسيطة
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/services">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                ابدأ طلبك
              </Button>
            </Link>
            <Link to="/designer/login">
              <Button size="lg" variant="outline" className="border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10 px-8">
                سجل كمصمم
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-background">
        <div className="container max-w-3xl">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">كيف يعمل؟</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { step: '١', label: 'اختر الخدمة', color: 'bg-cmyk-cyan' },
              { step: '٢', label: 'حدد القالب', color: 'bg-cmyk-magenta' },
              { step: '٣', label: 'أدخل بياناتك', color: 'bg-cmyk-yellow' },
              { step: '٤', label: 'استلم التصميم', color: 'bg-cmyk-key' },
            ].map((s, i) => (
              <div key={i}>
                <div className={`w-10 h-10 rounded-full ${s.color} text-white flex items-center justify-center mx-auto mb-3 text-sm font-bold ${s.color === 'bg-cmyk-yellow' ? 'text-foreground' : ''}`}>
                  {s.step}
                </div>
                <p className="text-sm font-medium text-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 bg-muted/50">
        <div className="container max-w-4xl">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">خدماتنا</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {SERVICES.map((service) => (
              <Link
                key={service.type}
                to={`/templates/${service.type}`}
                className="block bg-card rounded-lg p-5 text-center border border-border hover:border-primary/40 transition-colors"
              >
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center text-primary mx-auto mb-3">
                  {SERVICE_ICONS[service.type]}
                </div>
                <h4 className="font-bold text-foreground text-sm mb-1">{SERVICE_LABELS[service.type]}</h4>
                <p className="text-muted-foreground text-xs">{service.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-background">
        <div className="container max-w-3xl">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Zap className="w-6 h-6" />, title: 'سرعة في التنفيذ', desc: 'تصميمك جاهز خلال ساعات', color: 'text-cmyk-cyan' },
              { icon: <Star className="w-6 h-6" />, title: 'جودة احترافية', desc: 'مصممون بخبرة عالية', color: 'text-cmyk-magenta' },
              { icon: <Users className="w-6 h-6" />, title: 'تواصل مباشر', desc: 'تابع طلبك لحظة بلحظة', color: 'text-cmyk-yellow' },
            ].map((f, i) => (
              <div key={i} className="text-center">
                <div className={`${f.color} mx-auto mb-3`}>{f.icon}</div>
                <h4 className="font-bold text-foreground mb-1">{f.title}</h4>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
