import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { STATUS_LABELS, SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { useServices } from '@/hooks/useServices';
import { FileText, ShoppingBag, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { playNotificationSound } from '@/lib/notificationSound';
import SEOHead from '@/components/SEOHead';

const MyOrders = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { services } = useServices();

  const loadOrders = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from('orders')
      .select('*, templates(name, service_type)')
      .order('updated_at', { ascending: false });
    
    if (role !== 'admin') {
      query = query.eq('customer_id', user.id);
    }
    
    const { data: ordersData } = await query;
    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // Fetch order_items for all orders
    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from('order_items' as any)
      .select('*, templates(name, service_type)')
      .in('order_id', orderIds);

    const itemsByOrder = new Map<string, any[]>();
    (itemsData || []).forEach((item: any) => {
      const list = itemsByOrder.get(item.order_id) || [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    });

    setOrders(ordersData.map(o => ({
      ...o,
      _items: itemsByOrder.get(o.id) || [],
    })));
    setLoading(false);
  }, [user, role]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('my-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as any;
        const old = payload.old as any;
        if (role === 'admin' || row?.customer_id === user.id || old?.customer_id === user.id) {
          if (payload.eventType === 'UPDATE' && row?.status !== old?.status) {
            const label = STATUS_LABELS[row.status as OrderStatus] || row.status;
            playNotificationSound();
            toast({ title: `🔔 تحديث على طلبك`, description: label });
          }
          loadOrders();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => { loadOrders(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role, loadOrders]);

  const formatPrice = (serviceType: string | undefined, quantity: number) => {
    if (!serviceType) return '-';
    const svc = services.find(s => s.id === serviceType);
    if (!svc || !svc.price) return '-';
    const total = (svc.price / 1000) * quantity;
    return `${total.toLocaleString('en-US')} د.ع`;
  };

  if (loading) return (
    <div className="py-24 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
    </div>
  );

  return (
    <div className="section-spacing-sm">
      <SEOHead title="طلباتي" description="تتبع جميع طلباتك ومعرفة حالتها - مطبعتي" canonical="/my-orders" noindex />
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
            {orders.map((order, i) => {
              const hasItems = order._items && order._items.length > 0;
              const itemCount = hasItems ? order._items.length : 1;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/track-order/${order.id}`)}
                  className="bg-card rounded-2xl p-5 border border-border/60 shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center text-primary flex-shrink-0">
                        {itemCount > 1 ? <Package className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                      </div>
                      <div>
                        {hasItems ? (
                          <>
                            <h3 className="font-bold text-foreground text-sm">
                              {itemCount > 1 ? `${itemCount} عناصر` : (order._items[0] as any)?.templates?.name || '-'}
                            </h3>
                            {itemCount > 1 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {order._items.slice(0, 3).map((item: any, idx: number) => (
                                  <span key={idx} className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                    {item.templates?.name || SERVICE_LABELS[item.templates?.service_type as ServiceType] || '-'}
                                  </span>
                                ))}
                                {itemCount > 3 && <span className="text-[11px] text-muted-foreground">+{itemCount - 3}</span>}
                              </div>
                            )}
                            {itemCount === 1 && (
                              <p className="text-muted-foreground text-xs mt-0.5">
                                {SERVICE_LABELS[(order._items[0] as any)?.templates?.service_type as ServiceType] || ''}
                                {' · '}
                                الكمية: {((order._items[0] as any)?.details as any)?.quantity?.toLocaleString('en-US') || '-'}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <h3 className="font-bold text-foreground text-sm">{order.templates?.name || '-'}</h3>
                            <p className="text-muted-foreground text-xs mt-0.5">
                              {SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}
                              {' · '}
                              الكمية: {(order.details as any)?.quantity?.toLocaleString('en-US') || '-'}
                            </p>
                          </>
                        )}
                        <p className="text-muted-foreground text-[11px] mt-1">{new Date(order.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={order.status as OrderStatus} />
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

export default MyOrders;
