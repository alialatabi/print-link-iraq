import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useServices } from '@/hooks/useServices';

const ServiceSelection = () => {
  const { parentServices, loading: servicesLoading } = useServices();

  if (servicesLoading) {
    return (
      <div className="section-spacing-sm">
        <div className="container max-w-4xl text-center py-24">
          <p className="text-muted-foreground text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">اختر نوع الخدمة</h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">حدد نوع المطبوعة التي تريد تصميمها</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
          {parentServices.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
            >
              <Link
                to={`/sub-services/${service.id}`}
                className="group block bg-card rounded-2xl p-6 sm:p-8 text-center shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border border-border/60"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-5 group-hover:scale-105 transition-transform duration-200 overflow-hidden">
                  {service.icon_url ? (
                    <img src={service.icon_url} alt={service.label} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">{service.icon}</span>
                  )}
                </div>
                <h3 className="font-bold text-base sm:text-lg text-foreground mb-2">{service.label}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed whitespace-pre-line">{service.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ServiceSelection;
