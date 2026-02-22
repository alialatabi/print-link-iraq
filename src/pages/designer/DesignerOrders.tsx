import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { FileText, Eye, Clock, CheckCircle2, Upload, Inbox, Printer } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DesignerOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, templates(name, service_type)')
      .eq('designer_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const customerIds = [...new Set(ordersData.map(o => o.customer_id))];
    const { data: profilesData } = await supabase
      .rpc('get_customer_names_for_designer', { customer_ids: customerIds });
    
    const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
    
    setOrders(ordersData.map(o => ({
      ...o,
      profiles: profileMap.get(o.customer_id) || null,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('designer-orders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `designer_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new?.status === 'assigned' && payload.old?.status !== 'assigned') {
          toast({ title: '📝 عميل طلب تعديل على تصميم' });
        }
        loadOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadOrders]);

  const hiddenStatuses: OrderStatus[] = ['printed', 'delivered'];
  const visibleOrders = orders.filter(o => !hiddenStatuses.includes(o.status));

  const tabs: { key: string; label: string; status?: OrderStatus; icon: typeof Inbox; color: string }[] = [
    { key: 'all', label: 'الكل', icon: Inbox, color: 'text-primary' },
    { key: 'assigned', label: 'بانتظار الرفع', status: 'assigned', icon: Upload, color: 'text-cmyk-magenta' },
    { key: 'design_uploaded', label: 'تم الرفع', status: 'design_uploaded', icon: FileText, color: 'text-primary' },
    { key: 'waiting_approval', label: 'بانتظار الموافقة', status: 'waiting_approval', icon: Clock, color: 'text-cmyk-yellow' },
    { key: 'approved', label: 'تمت الموافقة', status: 'approved', icon: CheckCircle2, color: 'text-success' },
    { key: 'print_ready', label: 'جاهز للطباعة', status: 'print_ready', icon: Printer, color: 'text-success' },
  ];

  const getCount = (status?: OrderStatus) =>
    status ? visibleOrders.filter(o => o.status === status).length : visibleOrders.length;

  const filteredOrders = activeTab === 'all'
    ? visibleOrders
    : visibleOrders.filter(o => o.status === activeTab);

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;

  const OrderCard = ({ order, i }: { order: any; i: number }) => {
    const isApproved = order.status === 'approved';
    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06 }}
        className={cn(
          'rounded-xl p-5 border shadow-sm hover:shadow-md transition-all',
          isApproved
            ? 'bg-success/5 border-success/30 ring-1 ring-success/20'
            : 'bg-card border-border'
        )}
      >
        {isApproved && (
          <div className="flex items-center gap-2 text-success text-xs font-bold mb-3 bg-success/10 rounded-lg px-3 py-1.5 w-fit">
            <Printer className="w-3.5 h-3.5 animate-pulse" />
            بانتظار رفع ملف الطبع
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
              isApproved ? 'bg-success/15' : 'bg-primary/10'
            )}>
              <FileText className={cn('w-6 h-6', isApproved ? 'text-success' : 'text-primary')} />
            </div>
            <div>
              <h3 className="font-bold text-foreground">{order.templates?.name || '-'}</h3>
              <p className="text-muted-foreground text-sm">
                {order.profiles?.display_name || '-'} • {SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}
              </p>
              <p className="text-muted-foreground text-xs mt-1">{new Date(order.created_at).toLocaleDateString('ar')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={order.status as OrderStatus} />
            <Link to={`/designer/orders/${order.id}`}>
              <Button size="sm" variant={isApproved ? 'default' : 'outline'} className={cn('rounded-lg', isApproved && 'bg-success hover:bg-success/90 text-success-foreground')}>
                {isApproved ? <Printer className="w-4 h-4 ml-1" /> : <Eye className="w-4 h-4 ml-1" />}
                {isApproved ? 'رفع الملف' : 'عرض'}
              </Button>
            </Link>
          </div>
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
            const count = getCount(tab.status);
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
