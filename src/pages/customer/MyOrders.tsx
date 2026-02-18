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

  if (loading) return (
    <div className="py-24 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
    </div>
  );

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-4xl">
        <div className="mb-10">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">طلباتي</h1>
          <p className="text-muted-foreground text-sm mt-1">{orders.length} طلب</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-28">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-sm mb-6">لا توجد طلبات حتى الآن</p>
            <Link to="/services">
              <Button className="bg-success hover:bg-success/90 text-success-foreground">
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
                transition={{ delay: i * 0.04 }}
                className="bg-card rounded-2xl p-5 border border-border/60 shadow-card hover:shadow-card-hover transition-all duration-200"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center text-primary flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{order.templates?.name || '-'}</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}
                      </p>
                      <p className="text-muted-foreground text-[11px] mt-1">{new Date(order.created_at).toLocaleDateString('ar')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.status as OrderStatus} />
                    <Link to={`/track-order/${order.id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
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
