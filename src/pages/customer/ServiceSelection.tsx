import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, FileText, Receipt, ClipboardList, UtensilsCrossed, Mail } from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  business_card: <CreditCard className="w-10 h-10" />,
  flyer: <FileText className="w-10 h-10" />,
  receipt: <Receipt className="w-10 h-10" />,
  letterhead: <ClipboardList className="w-10 h-10" />,
  menu: <UtensilsCrossed className="w-10 h-10" />,
  invitation: <Mail className="w-10 h-10" />,
};

const ServiceSelection = () => {
  const [priceRanges, setPriceRanges] = useState<Record<string, { min: number; max: number } | null>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('templates')
        .select('service_type, price');
      if (!data) return;

      const ranges: Record<string, { min: number; max: number }> = {};
      for (const row of data) {
        if (row.price == null) continue;
        const st = row.service_type as string;
        if (!ranges[st]) {
          ranges[st] = { min: row.price, max: row.price };
        } else {
          ranges[st].min = Math.min(ranges[st].min, row.price);
          ranges[st].max = Math.max(ranges[st].max, row.price);
        }
      }
      setPriceRanges(ranges);
    };
    load();
  }, []);

  const formatPrice = (range: { min: number; max: number } | undefined) => {
    if (!range) return null;
    if (range.min === range.max) return `${range.min.toLocaleString('en-US')} د.ع`;
    return `${range.min.toLocaleString('en-US')} - ${range.max.toLocaleString('en-US')} د.ع`;
  };

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">اختر نوع الخدمة</h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">حدد نوع المطبوعة التي تريد تصميمها</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
          {SERVICES.map((service, i) => (
            <motion.div
              key={service.type}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
            >
              <Link
                to={`/specializations/${service.type}`}
                className="group block bg-card rounded-2xl p-6 sm:p-8 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/60"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center text-primary mx-auto mb-5 group-hover:scale-105 transition-transform duration-200">
                  {ICONS[service.type]}
                </div>
                <h3 className="font-bold text-base sm:text-lg text-foreground mb-2">{SERVICE_LABELS[service.type]}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{service.description}</p>
                {priceRanges[service.type] && (
                  <p className="text-primary font-bold text-sm mt-4">
                    {formatPrice(priceRanges[service.type]!)}
                  </p>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServiceSelection;
