import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS } from '@/data/mockData';
import { FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DesignerOrders = () => {
  const { orders } = useApp();
  const designerOrders = orders.filter(o => 
    ['assigned', 'design_uploaded', 'waiting_approval', 'submitted'].includes(o.status)
  );

  return (
    <div className="py-12">
      <div className="container max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">طلبات التصميم</h1>
            <p className="text-muted-foreground">{designerOrders.length} طلب</p>
          </div>
        </div>

        {designerOrders.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">لا توجد طلبات حالياً</p>
          </div>
        ) : (
          <div className="space-y-4">
            {designerOrders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="bg-card rounded-xl p-5 border border-border shadow-card hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{order.template_name}</h3>
                      <p className="text-muted-foreground text-sm">
                        {order.customer_name} • {SERVICE_LABELS[order.service_type]}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">{order.created_at}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.status} />
                    <Link to={`/designer/orders/${order.id}`}>
                      <Button size="sm" variant="outline" className="rounded-lg">
                        <Eye className="w-4 h-4 ml-1" />
                        عرض
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignerOrders;
