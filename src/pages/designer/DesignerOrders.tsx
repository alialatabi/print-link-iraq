import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { FileText, Eye, Clock, CheckCircle2, Upload, Inbox, Printer, Package, Edit2, Search, AlertTriangle, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CustomerProfile {
  user_id: string;
  display_name: string | null;
}

interface DesignerOrderItem {
  id: string;
  order_id: string;
  status: OrderStatus;
  details: Record<string, any> | null;
  templates?: { name: string; service_type: string } | null;
}

interface DesignerOrder {
  id: string;
  customer_id: string;
  designer_id: string | null;
  template_id: string | null;
  status: OrderStatus;
  details: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  templates?: { name: string; service_type: string } | null;
  profiles: CustomerProfile | null;
  _items: DesignerOrderItem[];
}

// ---------------------------------------------------------------------------
// Constants & pure helpers (module scope — not re-created on every render)
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;
const ORDER_SELECT =
  'id, customer_id, designer_id, template_id, status, details, created_at, updated_at, templates(name, service_type)';
const COMPLETED_STATUSES: OrderStatus[] = ['print_ready', 'printed', 'delivered'];
// Completed orders live in the "archive" tab; keep them out of the active query.
const ACTIVE_EXCLUDE = '(print_ready,printed,delivered)';
const OVERDUE_MS = 24 * 60 * 60 * 1000;

/** Short, human-referenceable code derived from the order UUID (no order_number column exists). */
const formatOrderRef = (id: string) => `#${id.slice(-6).toUpperCase()}`;

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDate = (iso: string) => dateFmt.format(new Date(iso));

/** Arabic relative time with Latin digits (consistent with the en-US number formatting used elsewhere). */
const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return formatDate(iso);
};

const hasRevisionItems = (order: DesignerOrder) =>
  (order._items || []).some((item) => {
    const revisions = item.details?.revisions;
    return item.status === 'assigned' && Array.isArray(revisions) && revisions.length > 0;
  });

const isNewAssigned = (order: DesignerOrder) => order.status === 'assigned' && !hasRevisionItems(order);

/** Awaiting the designer's first action for more than a day. */
const isOverdue = (order: DesignerOrder) =>
  isNewAssigned(order) && Date.now() - new Date(order.updated_at || order.created_at).getTime() > OVERDUE_MS;

const matchesQuery = (order: DesignerOrder, q: string) => {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return (
    formatOrderRef(order.id).toLowerCase().includes(needle) ||
    order.id.toLowerCase().includes(needle) ||
    (order.profiles?.display_name || '').toLowerCase().includes(needle)
  );
};

// ---------------------------------------------------------------------------
// Presentational components (hoisted)
// ---------------------------------------------------------------------------
const SkeletonCard = () => (
  <div className="rounded-xl p-5 border border-border bg-card">
    <div className="flex items-center gap-4">
      <Skeleton className="w-12 h-12 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-20 rounded-lg" />
    </div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="text-center py-16">
    <FileText className="w-14 h-14 text-muted-foreground/40 mx-auto mb-3" />
    <p className="text-muted-foreground">{message}</p>
  </div>
);

interface OrderCardProps {
  order: DesignerOrder;
  index: number;
  onOpen: (id: string) => void;
}

const OrderCard = ({ order, index, onOpen }: OrderCardProps) => {
  const isApproved = order.status === 'approved';
  const isRevision = hasRevisionItems(order);
  const overdue = isOverdue(order);
  const hasItems = order._items && order._items.length > 0;
  const itemCount = hasItems ? order._items.length : 1;
  const isReseller = order.details?.order_type === 'reseller';
  const reviewResult = order.details?.review?.result;
  const resellerRejected = isReseller && reviewResult === 'rejected';
  const needsResellerReview =
    isReseller && !isApproved && !COMPLETED_STATUSES.includes(order.status) && reviewResult !== 'rejected';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.05 }}
      role="button"
      tabIndex={0}
      aria-label={`فتح الطلب ${formatOrderRef(order.id)} — ${order.profiles?.display_name || ''}`}
      onClick={() => onOpen(order.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(order.id);
        }
      }}
      className={cn(
        'rounded-xl p-5 border shadow-sm hover:shadow-md transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        isApproved
          ? 'bg-success/5 border-success/30 ring-1 ring-success/20'
          : isRevision
          ? 'bg-destructive/5 border-destructive/30 ring-1 ring-destructive/20'
          : 'bg-card border-border'
      )}
    >
      {/* Status / urgency ribbons */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {isReseller ? (
          <>
            {needsResellerReview && (
              <span className="flex items-center gap-2 text-primary text-xs font-bold bg-primary/10 rounded-lg px-3 py-1.5">
                <Eye className="w-3.5 h-3.5 animate-pulse" />
                مراجعة تصميم مطبعة
              </span>
            )}
            {resellerRejected && (
              <span className="flex items-center gap-2 text-destructive text-xs font-bold bg-destructive/10 rounded-lg px-3 py-1.5">
                <Edit2 className="w-3.5 h-3.5" />
                بانتظار تعديل المطبعة
              </span>
            )}
            {isApproved && (
              <span className="flex items-center gap-2 text-success text-xs font-bold bg-success/10 rounded-lg px-3 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                تمت الموافقة — قيد الطباعة
              </span>
            )}
          </>
        ) : (
          <>
            {isApproved && (
              <span className="flex items-center gap-2 text-success text-xs font-bold bg-success/10 rounded-lg px-3 py-1.5">
                <Printer className="w-3.5 h-3.5 animate-pulse" />
                بانتظار رفع ملف الطبع
              </span>
            )}
            {isRevision && (
              <span className="flex items-center gap-2 text-destructive text-xs font-bold bg-destructive/10 rounded-lg px-3 py-1.5">
                <Edit2 className="w-3.5 h-3.5 animate-pulse" />
                مطلوب تعديل
              </span>
            )}
          </>
        )}
        {overdue && (
          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-bold bg-amber-500/15 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            متأخر
          </span>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
              isApproved ? 'bg-success/15' : isRevision ? 'bg-destructive/15' : 'bg-primary/10'
            )}
          >
            {itemCount > 1 ? (
              <Package className={cn('w-6 h-6', isApproved ? 'text-success' : 'text-primary')} />
            ) : (
              <FileText className={cn('w-6 h-6', isApproved ? 'text-success' : 'text-primary')} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground">
                {order.profiles?.display_name || '-'}
                {itemCount > 1 && (
                  <span className="text-xs font-normal text-muted-foreground mr-2">({itemCount} عناصر)</span>
                )}
              </h3>
              <span className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {formatOrderRef(order.id)}
              </span>
            </div>
            {isReseller ? (
              <p className="text-muted-foreground text-sm">
                {order.details?.service_label || 'طلب طباعة'}
                {order.details?.quantity ? ` • ${Number(order.details.quantity).toLocaleString('en-US')}` : ''}
              </p>
            ) : hasItems ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {order._items.slice(0, 3).map((item, idx) => (
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
            <p className="text-muted-foreground text-xs mt-1" title={formatDate(order.created_at)}>
              {timeAgo(order.created_at)}
            </p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const DesignerOrders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState<DesignerOrder[]>([]); // active orders
  const [archived, setArchived] = useState<DesignerOrder[]>([]);
  const [archiveCount, setArchiveCount] = useState(0);
  const [archivedLoaded, setArchivedLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [activeLimit, setActiveLimit] = useState(PAGE_SIZE);
  const [archiveLimit, setArchiveLimit] = useState(PAGE_SIZE);
  const [activeHasMore, setActiveHasMore] = useState(false);
  const [archiveHasMore, setArchiveHasMore] = useState(false);

  // IDs of orders owned by this designer — used to guard the order_items realtime channel.
  const ownedOrderIds = useRef<Set<string>>(new Set());
  const reloadTimer = useRef<ReturnType<typeof setTimeout>>();
  const reloadRef = useRef<() => void>(() => {});

  /** Attach customer names + order_items to a batch of orders. */
  const hydrate = useCallback(async (rows: any[]): Promise<DesignerOrder[]> => {
    if (!rows.length) return [];
    const customerIds = [...new Set(rows.map((o) => o.customer_id))];
    const orderIds = rows.map((o) => o.id);

    const [{ data: profilesData }, { data: itemsData }] = await Promise.all([
      supabase.rpc('get_customer_names_for_designer', { customer_ids: customerIds }),
      supabase.from('order_items' as any).select('*, templates(name, service_type)').in('order_id', orderIds),
    ]);

    const profileMap = new Map((profilesData || []).map((p: any) => [p.user_id, p]));
    const itemsByOrder = new Map<string, DesignerOrderItem[]>();
    (itemsData || []).forEach((item: any) => {
      const list = itemsByOrder.get(item.order_id) || [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    });

    return rows.map((o) => ({
      ...o,
      profiles: (profileMap.get(o.customer_id) as CustomerProfile) || null,
      _items: itemsByOrder.get(o.id) || [],
    }));
  }, []);

  const refreshArchiveCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('designer_id', user.id)
      .in('status', COMPLETED_STATUSES);
    setArchiveCount(count || 0);
  }, [user]);

  const loadActive = useCallback(async () => {
    if (!user) return;
    const { data, error: qErr } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('designer_id', user.id)
      .not('status', 'in', ACTIVE_EXCLUDE)
      .order('created_at', { ascending: false })
      .limit(activeLimit);

    if (qErr) {
      setError('تعذّر تحميل الطلبات. تأكد من الاتصال وحاول مرة أخرى.');
      setLoading(false);
      return;
    }
    setError(null);
    const rows = await hydrate(data || []);
    rows.forEach((r) => ownedOrderIds.current.add(r.id));
    setOrders(rows);
    setActiveHasMore((data?.length || 0) === activeLimit);
    setLoading(false);
  }, [user, activeLimit, hydrate]);

  const loadArchive = useCallback(async () => {
    if (!user) return;
    setArchiveLoading(true);
    const { data, error: qErr } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('designer_id', user.id)
      .in('status', COMPLETED_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(archiveLimit);

    if (qErr) {
      setArchiveLoading(false);
      toast({ title: 'تعذّر تحميل الطلبات المكتملة', variant: 'destructive' });
      return;
    }
    const rows = await hydrate(data || []);
    rows.forEach((r) => ownedOrderIds.current.add(r.id));
    setArchived(rows);
    setArchiveHasMore((data?.length || 0) === archiveLimit);
    setArchivedLoaded(true);
    setArchiveLoading(false);
  }, [user, archiveLimit, hydrate]);

  // Initial / pagination load of active orders.
  useEffect(() => {
    loadActive();
  }, [loadActive]);

  // Archive count badge.
  useEffect(() => {
    refreshArchiveCount();
  }, [refreshArchiveCount]);

  // Lazy-load archive when its tab is opened; reload on "load more".
  useEffect(() => {
    if (activeTab === 'archive') loadArchive();
  }, [activeTab, archiveLimit, loadArchive]);

  // Keep the realtime reload pointing at the latest loaders/state.
  reloadRef.current = () => {
    loadActive();
    refreshArchiveCount();
    if (archivedLoaded) loadArchive();
  };

  // Realtime: debounced reloads, scoped to this designer's orders.
  useEffect(() => {
    if (!user) return;
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => reloadRef.current(), 400);
    };

    const channel = supabase
      .channel('designer-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        if (newRow?.designer_id === user.id || oldRow?.designer_id === user.id) {
          if (payload.eventType === 'UPDATE' && newRow?.designer_id === user.id && oldRow?.designer_id !== user.id) {
            toast({ title: '🎨 تم تعيين طلب جديد لك!' });
          }
          scheduleReload();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
        // Ownership guard: only react to items belonging to this designer's orders.
        const orderId = (payload.new as any)?.order_id || (payload.old as any)?.order_id;
        if (orderId && ownedOrderIds.current.has(orderId)) scheduleReload();
      })
      .subscribe();

    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [user]);

  const tabs: { key: string; label: string; icon: typeof Inbox; color: string }[] = [
    { key: 'all', label: 'الكل', icon: Inbox, color: 'text-primary' },
    { key: 'assigned', label: 'بانتظار الرفع', icon: Upload, color: 'text-cmyk-magenta' },
    { key: 'revisions', label: 'تعديلات', icon: Edit2, color: 'text-destructive' },
    { key: 'waiting_approval', label: 'بانتظار الموافقة', icon: Clock, color: 'text-cmyk-yellow' },
    { key: 'approved', label: 'تمت الموافقة', icon: CheckCircle2, color: 'text-success' },
    { key: 'archive', label: 'مكتملة', icon: Package, color: 'text-muted-foreground' },
  ];

  const getCount = (key: string) => {
    if (key === 'archive') return archiveCount;
    if (key === 'all') return orders.length;
    if (key === 'assigned') return orders.filter(isNewAssigned).length;
    if (key === 'revisions') return orders.filter(hasRevisionItems).length;
    return orders.filter((o) => o.status === key).length;
  };

  const filteredOrders = useMemo(() => {
    let src: DesignerOrder[];
    if (activeTab === 'archive') src = archived;
    else if (activeTab === 'all') src = orders;
    else if (activeTab === 'assigned') src = orders.filter(isNewAssigned);
    else if (activeTab === 'revisions') src = orders.filter(hasRevisionItems);
    else src = orders.filter((o) => o.status === activeTab);
    return src.filter((o) => matchesQuery(o, query));
  }, [activeTab, orders, archived, query]);

  const isArchive = activeTab === 'archive';
  const showLoadMore = isArchive ? archiveHasMore : activeHasMore;
  const openOrder = useCallback((id: string) => navigate(`/designer/orders/${id}`), [navigate]);

  return (
    <div className="py-8">
      <div className="container max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">لوحة المصمم</h1>
          <p className="text-muted-foreground text-sm">إدارة ومتابعة طلبات التصميم</p>
        </div>

        {/* Search */}
        <div className="relative mb-4" dir="rtl">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم الزبون أو رقم الطلب (#)…"
            className="pr-10 pl-9"
            aria-label="بحث في الطلبات"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="مسح البحث"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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
                  <span
                    className={cn(
                      'text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {error ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 text-destructive/70 mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">حدث خطأ</p>
            <p className="text-muted-foreground text-sm mb-4">{error}</p>
            <Button
              onClick={() => {
                setLoading(true);
                loadActive();
              }}
            >
              إعادة المحاولة
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isArchive && archiveLoading && archived.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            message={
              query
                ? 'لا توجد نتائج مطابقة لبحثك'
                : isArchive
                ? 'لا توجد طلبات مكتملة بعد'
                : 'لا توجد طلبات في هذا القسم'
            }
          />
        ) : (
          <>
            <div className="space-y-3">
              {filteredOrders.map((order, i) => (
                <OrderCard key={order.id} order={order} index={i} onOpen={openOrder} />
              ))}
            </div>

            {showLoadMore && !query && (
              <div className="text-center mt-6">
                <Button
                  variant="outline"
                  disabled={archiveLoading}
                  onClick={() => (isArchive ? setArchiveLimit((n) => n + PAGE_SIZE) : setActiveLimit((n) => n + PAGE_SIZE))}
                >
                  {archiveLoading ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : null}
                  عرض المزيد
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DesignerOrders;
