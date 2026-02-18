import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { FileText, Eye, ShoppingBag, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MyOrders = () => {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      let query = supabase
        .from('orders')
        .select('*, templates(name, service_type, price)')
        .order('created_at', { ascending: false });
      
      // Admins see all orders, customers see only their own
      if (role !== 'admin') {
        query = query.eq('customer_id', user.id);
      }
      
      const { data } = await query;
      setOrders(data || []);
      setLoading(false);
    };
    load();
  }, [user, role]);
  const formatPrice = (price: number | null, quantity: number) => {
    if (!price) return '-';
    const total = (price / 1000) * quantity;
    return `${total.toLocaleString('ar-IQ')} د.ع`;
  };

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
                        {' · '}
                        الكمية: {(order.details as any)?.quantity?.toLocaleString('ar-IQ') || '-'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-muted-foreground text-[11px]">{new Date(order.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        <span className="text-muted-foreground/40 text-[11px]">·</span>
                        <p className="text-[11px] font-semibold text-foreground">
                          {formatPrice(order.templates?.price, (order.details as any)?.quantity || 1000)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={order.status as OrderStatus} />
                    <Link to={`/track-order/${order.id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        تتبع
                      </Button>
                    </Link>
                    {order.template_id && (
                      <Link to={`/template/${order.template_id}`}>
                        <Button size="sm" variant="ghost" className="gap-1.5 text-primary">
                          <RefreshCw className="w-3.5 h-3.5" />
                          طلب مرة أخرى
                        </Button>
                      </Link>
                    )}
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
