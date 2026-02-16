import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SERVICES, SERVICE_LABELS } from '@/data/mockData';
import { CreditCard, FileText, Receipt, ClipboardList, UtensilsCrossed, Mail } from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  business_card: <CreditCard className="w-12 h-12" />,
  flyer: <FileText className="w-12 h-12" />,
  receipt: <Receipt className="w-12 h-12" />,
  letterhead: <ClipboardList className="w-12 h-12" />,
  menu: <UtensilsCrossed className="w-12 h-12" />,
  invitation: <Mail className="w-12 h-12" />,
};

const ServiceSelection = () => (
  <div className="py-12">
    <div className="container max-w-4xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-3">اختر نوع الخدمة</h1>
        <p className="text-muted-foreground">حدد نوع المطبوعة التي تريد تصميمها</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        {SERVICES.map((service, i) => (
          <motion.div
            key={service.type}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
          >
            <Link
              to={`/templates/${service.type}`}
              className="group block bg-card rounded-xl p-8 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border"
            >
              <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground mx-auto mb-4 group-hover:scale-110 transition-transform">
                {ICONS[service.type]}
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">{SERVICE_LABELS[service.type]}</h3>
              <p className="text-muted-foreground text-sm">{service.description}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  </div>
);

export default ServiceSelection;
