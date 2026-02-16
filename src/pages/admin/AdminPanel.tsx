import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, OrderStatus } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Download, Printer, Truck, CheckCircle, Package } from 'lucide-react';

const ADMIN_STATUSES: { from: OrderStatus; to: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { from: 'approved', to: 'print_ready', label: 'جاهز للطباعة', icon: <Printer className="w-4 h-4" /> },
  { from: 'print_ready', to: 'printed', label: 'تمت الطباعة', icon: <CheckCircle className="w-4 h-4" /> },
  { from: 'printed', to: 'delivered', label: 'تم التسليم', icon: <Truck className="w-4 h-4" /> },
];

const AdminPanel = () => {
  const { orders, updateOrderStatus } = useApp();
  const approvedOrders = orders.filter(o =>
    ['approved', 'print_ready', 'printed', 'delivered'].includes(o.status)
  );

  return (
    <div className="py-12">
      <div className="container max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">لوحة الطباعة</h1>
          <p className="text-muted-foreground">إدارة الطلبات الموافق عليها</p>
        </div>

        {approvedOrders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">لا توجد طلبات موافق عليها</p>
          </div>
        ) : (
          <div className="space-y-4">
            {approvedOrders.map((order, i) => {
              const nextAction = ADMIN_STATUSES.find(s => s.from === order.status);
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-card rounded-xl p-5 border border-border shadow-card"
                >
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-foreground">{order.template_name}</h3>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground">
                        <span>الزبون: {order.customer_name}</span>
                        <span>الخدمة: {SERVICE_LABELS[order.service_type]}</span>
                        <span dir="ltr">هاتف: {order.customer_phone}</span>
                        <span>{order.created_at}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="rounded-lg">
                        <Download className="w-4 h-4 ml-1" />
                        تحميل
                      </Button>
                      {nextAction && (
                        <Button
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, nextAction.to)}
                          className="bg-success hover:bg-success/90 text-success-foreground rounded-lg"
                        >
                          {nextAction.icon}
                          <span className="mr-1">{nextAction.label}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
