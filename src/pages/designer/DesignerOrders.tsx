import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { FileText, Eye, Clock, CheckCircle2, Upload, Inbox } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';


const DesignerOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('*, templates(name, service_type)')
      .eq('designer_id', user.id)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Realtime: auto-refresh when orders change
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

  // Hide approved, printed, delivered from designer view
  const hiddenStatuses: OrderStatus[] = ['approved', 'printed', 'delivered'];
  const visibleOrders = orders.filter(o => !hiddenStatuses.includes(o.status));

  const sections: { label: string; status: OrderStatus; icon: typeof Inbox; color: string }[] = [
    { label: 'بانتظار رفع التصميم', status: 'assigned', icon: Upload, color: 'text-cmyk-magenta' },
    { label: 'تم رفع التصميم', status: 'design_uploaded', icon: FileText, color: 'text-primary' },
    { label: 'بانتظار موافقة العميل', status: 'waiting_approval', icon: Clock, color: 'text-cmyk-yellow' },
    { label: 'جاهز للطباعة', status: 'print_ready', icon: CheckCircle2, color: 'text-success' },
  ];

  const stats = [
    { label: 'الكل', value: visibleOrders.length, icon: Inbox, color: 'text-primary' },
    { label: 'بانتظار رفع', value: visibleOrders.filter(o => o.status === 'assigned').length, icon: Upload, color: 'text-cmyk-magenta' },
    { label: 'بانتظار موافقة', value: visibleOrders.filter(o => o.status === 'waiting_approval').length, icon: Clock, color: 'text-cmyk-yellow' },
    { label: 'جاهز للطباعة', value: visibleOrders.filter(o => o.status === 'print_ready').length, icon: CheckCircle2, color: 'text-success' },
  ];

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;

  const OrderCard = ({ order, i }: { order: any; i: number }) => (
    <motion.div
      key={order.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.06 }}
      className="bg-card rounded-xl p-5 border border-border shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{order.templates?.name || '-'}</h3>
            <p className="text-muted-foreground text-sm">
              {order.customer_name} • {SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}
            </p>
            <p className="text-muted-foreground text-xs mt-1">{new Date(order.created_at).toLocaleDateString('ar')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status as OrderStatus} />
          <Link to={`/designer/orders/${order.id}`}>
            <Button size="sm" variant="outline" className="rounded-lg">
              <Eye className="w-4 h-4 ml-1" />
              عرض
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-16">
      <FileText className="w-14 h-14 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );

  return (
    <div className="py-8">
      <div className="container max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-1">لوحة المصمم</h1>
          <p className="text-muted-foreground text-sm">إدارة ومتابعة طلبات التصميم</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-xl p-4 border border-border text-center">
              <s.icon className={`w-6 h-6 mx-auto mb-2 ${s.color}`} />
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-muted-foreground text-xs">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sections grouped by status */}
        {sections.map((section) => {
          const sectionOrders = visibleOrders.filter(o => o.status === section.status);
          if (sectionOrders.length === 0) return null;
          return (
            <div key={section.status} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <section.icon className={`w-5 h-5 ${section.color}`} />
                <h2 className="text-lg font-bold text-foreground">{section.label}</h2>
                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {sectionOrders.length}
                </span>
              </div>
              <div className="space-y-3">
                {sectionOrders.map((order, i) => <OrderCard key={order.id} order={order} i={i} />)}
              </div>
            </div>
          );
        })}
        {visibleOrders.length === 0 && <EmptyState message="لا توجد طلبات حالياً" />}
      </div>
    </div>
  );
};

export default DesignerOrders;
