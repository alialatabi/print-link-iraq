import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { FileText, Eye, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MyOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('orders')
        .select('*, templates(name, service_type)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
      setOrders(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;

  return (
    <div className="py-12">
      <div className="container max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">طلباتي</h1>
          <p className="text-muted-foreground">{orders.length} طلب</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg mb-4">لا توجد طلبات حتى الآن</p>
            <Link to="/services">
              <Button className="bg-success hover:bg-success/90 text-success-foreground rounded-xl">
                ابدأ طلبك الأول
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-card rounded-xl p-5 border border-border shadow-card"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{order.templates?.name || '-'}</h3>
                      <p className="text-muted-foreground text-sm">
                        {SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">{new Date(order.created_at).toLocaleDateString('ar')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.status as OrderStatus} />
                    <Link to={`/track-order/${order.id}`}>
                      <Button size="sm" variant="outline" className="rounded-lg">
                        <Eye className="w-4 h-4 ml-1" />
                        تتبع
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

export default MyOrders;
