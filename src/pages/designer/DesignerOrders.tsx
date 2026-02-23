import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { FileText, Eye, Clock, CheckCircle2, Upload, Inbox, Printer, Package, Edit2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DesignerOrders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, customer_id, designer_id, template_id, status, details, created_at, updated_at, templates(name, service_type)')
      .eq('designer_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    // Fetch customer profiles
    const customerIds = [...new Set(ordersData.map(o => o.customer_id))];
    const { data: profilesData } = await supabase
      .rpc('get_customer_names_for_designer', { customer_ids: customerIds });
    const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));

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
      profiles: profileMap.get(o.customer_id) || null,
      _items: itemsByOrder.get(o.id) || [],
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('designer-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        if (newRow?.designer_id === user.id || oldRow?.designer_id === user.id) {
          if (payload.eventType === 'UPDATE' && newRow?.designer_id === user.id && oldRow?.designer_id !== user.id) {
            toast({ title: '🎨 تم تعيين طلب جديد لك!' });
          }
          loadOrders();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => { loadOrders(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadOrders]);

  const hiddenStatuses: OrderStatus[] = ['printed', 'delivered'];
  const visibleOrders = orders.filter(o => !hiddenStatuses.includes(o.status));

  // Helper: does an order have items needing revision (assigned items with revisions)?
  const hasRevisionItems = (order: any) => {
    return (order._items || []).some((item: any) => {
      const revisions = item.details?.revisions;
      return item.status === 'assigned' && Array.isArray(revisions) && revisions.length > 0;
    });
  };

  // Helper: is a "new" assigned order (no revision items)
  const isNewAssigned = (order: any) => order.status === 'assigned' && !hasRevisionItems(order);

  const tabs: { key: string; label: string; icon: typeof Inbox; color: string }[] = [
    { key: 'all', label: 'الكل', icon: Inbox, color: 'text-primary' },
    { key: 'assigned', label: 'بانتظار الرفع', icon: Upload, color: 'text-cmyk-magenta' },
    { key: 'revisions', label: 'تعديلات', icon: Edit2, color: 'text-destructive' },
    { key: 'design_uploaded', label: 'تم الرفع', icon: FileText, color: 'text-primary' },
    { key: 'waiting_approval', label: 'بانتظار الموافقة', icon: Clock, color: 'text-cmyk-yellow' },
    { key: 'approved', label: 'تمت الموافقة', icon: CheckCircle2, color: 'text-success' },
    { key: 'print_ready', label: 'جاهز للطباعة', icon: Printer, color: 'text-success' },
  ];

  const getCount = (key: string) => {
    if (key === 'all') return visibleOrders.length;
    if (key === 'assigned') return visibleOrders.filter(o => isNewAssigned(o)).length;
    if (key === 'revisions') return visibleOrders.filter(o => hasRevisionItems(o)).length;
    return visibleOrders.filter(o => o.status === key).length;
  };

  const filteredOrders = (() => {
    if (activeTab === 'all') return visibleOrders;
    if (activeTab === 'assigned') return visibleOrders.filter(o => isNewAssigned(o));
    if (activeTab === 'revisions') return visibleOrders.filter(o => hasRevisionItems(o));
    return visibleOrders.filter(o => o.status === activeTab);
  })();

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;

  const OrderCard = ({ order, i }: { order: any; i: number }) => {
    const isApproved = order.status === 'approved';
    const isRevision = hasRevisionItems(order);
    const hasItems = order._items && order._items.length > 0;
    const itemCount = hasItems ? order._items.length : 1;

    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06 }}
        onClick={() => navigate(`/designer/orders/${order.id}`)}
        className={cn(
          'rounded-xl p-5 border shadow-sm hover:shadow-md transition-all cursor-pointer',
          isApproved
            ? 'bg-success/5 border-success/30 ring-1 ring-success/20'
            : isRevision
            ? 'bg-destructive/5 border-destructive/30 ring-1 ring-destructive/20'
            : 'bg-card border-border'
        )}
      >
        {isApproved && (
          <div className="flex items-center gap-2 text-success text-xs font-bold mb-3 bg-success/10 rounded-lg px-3 py-1.5 w-fit">
            <Printer className="w-3.5 h-3.5 animate-pulse" />
            بانتظار رفع ملف الطبع
          </div>
        )}
        {isRevision && (
          <div className="flex items-center gap-2 text-destructive text-xs font-bold mb-3 bg-destructive/10 rounded-lg px-3 py-1.5 w-fit">
            <Edit2 className="w-3.5 h-3.5 animate-pulse" />
            مطلوب تعديل
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
              isApproved ? 'bg-success/15' : isRevision ? 'bg-destructive/15' : 'bg-primary/10'
            )}>
              {itemCount > 1 ? (
                <Package className={cn('w-6 h-6', isApproved ? 'text-success' : 'text-primary')} />
              ) : (
                <FileText className={cn('w-6 h-6', isApproved ? 'text-success' : 'text-primary')} />
              )}
            </div>
            <div>
              <h3 className="font-bold text-foreground">
                {order.profiles?.display_name || '-'}
                {itemCount > 1 && (
                  <span className="text-xs font-normal text-muted-foreground mr-2">({itemCount} عناصر)</span>
                )}
              </h3>
              {hasItems ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {order._items.slice(0, 3).map((item: any, idx: number) => (
                    <span key={idx} className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      {item.templates?.name || SERVICE_LABELS[item.templates?.service_type as ServiceType] || '-'}
                    </span>
                  ))}
                  {itemCount > 3 && <span className="text-[11px] text-muted-foreground">+{itemCount - 3}</span>}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {order.templates?.name || '-'} • {SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}
                </p>
              )}
              <p className="text-muted-foreground text-xs mt-1">{new Date(order.created_at).toLocaleDateString('ar')}</p>
            </div>
          </div>
          <StatusBadge status={order.status as OrderStatus} />
        </div>
      </motion.div>
    );
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-16">
      <FileText className="w-14 h-14 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );

  return (
    <div className="py-8">
      <div className="container max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">لوحة المصمم</h1>
          <p className="text-muted-foreground text-sm">إدارة ومتابعة طلبات التصميم</p>
        </div>

        {/* Section Navbar */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide" dir="rtl">
          {tabs.map((tab) => {
            const count = getCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
                )}
              >
                <tab.icon className={cn('w-4 h-4', isActive ? 'text-primary-foreground' : tab.color)} />
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    'text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-primary/10 text-primary'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Orders */}
        {filteredOrders.length === 0 ? (
          <EmptyState message="لا توجد طلبات في هذا القسم" />
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order, i) => <OrderCard key={order.id} order={order} i={i} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default DesignerOrders;
