import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { OrderDetailsJson } from '@/types/db';
import { useNavigate } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCustomerNamesForDesigner,
  queryDesignerOrderItemsBatch,
  countDesignerArchivedOrders,
  queryDesignerActiveOrders,
  queryDesignerActiveOrderCounts,
  queryDesignerArchivedOrders,
  aggregateActiveCounts,
  oldestActiveAgeDays,
  overdueFirst,
  orderHasRevision,
  isNewAssignedOrder,
  isOrderOverdue,
  parseSortKey,
  type ActiveQueueCounts,
  type CountableOrder,
  type RevisionItemLike,
  type DesignerSortKey,
} from '@/services/designer';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { FileText, Eye, Clock, CheckCircle2, Upload, Inbox, Printer, Package, Edit2, Search, AlertTriangle, Loader2, X, ArrowDownUp, Hourglass } from 'lucide-react';
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
  details: OrderDetailsJson | null;
  templates?: { name: string; service_type: string } | null;
}

interface DesignerOrder {
  id: string;
  customer_id: string;
  designer_id: string | null;
  template_id: string | null;
  status: OrderStatus;
  details: OrderDetailsJson | null;
  created_at: string;
  updated_at: string;
  templates?: { name: string; service_type: string } | null;
  profiles: CustomerProfile | null;
  _items: DesignerOrderItem[];
}

/** Row shape returned by the lightweight count query (DESIGNER_COUNT_SELECT). */
interface CountResponseRow {
  status: OrderStatus;
  created_at: string;
  updated_at: string | null;
  order_items: RevisionItemLike[] | null;
}

// ---------------------------------------------------------------------------
// Constants & pure helpers (module scope — not re-created on every render)
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;
const COMPLETED_STATUSES: OrderStatus[] = ['print_ready', 'printed', 'delivered'];
// Completed orders live in the "archive" tab; keep them out of the active query.
const ACTIVE_EXCLUDE = '(print_ready,printed,delivered)';
// Safety cap for the un-paginated count query — a real active queue is dozens.
const COUNT_CAP = 500;
const SORT_STORAGE_KEY = 'designer.orders.sort';
const SORT_OPTIONS: { key: DesignerSortKey; label: string }[] = [
  { key: 'newest', label: 'الأحدث' },
  { key: 'oldest', label: 'الأقدم أولاً' },
  { key: 'overdue', label: 'المتأخرة أولاً' },
];

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

// Thin adapters over the pure, unit-tested bucket helpers in services/designer.
// so the list, the tab badges and the workload strip can never disagree.
const hasRevisionItems = (order: DesignerOrder) => orderHasRevision(order._items);

const isNewAssigned = (order: DesignerOrder) => isNewAssignedOrder(order.status, order._items);

/** Awaiting the designer's first action for more than a day. */
const isOverdue = (order: DesignerOrder) =>
  isOrderOverdue(
    { status: order.status, created_at: order.created_at, updated_at: order.updated_at, items: order._items },
    Date.now(),
  );

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
  // True (un-paginated) counts for the tab badges + workload strip.
  const [counts, setCounts] = useState<ActiveQueueCounts>({
    all: 0,
    assigned: 0,
    revisions: 0,
    waiting_approval: 0,
    approved: 0,
    overdue: 0,
  });
  const [oldestAgeDays, setOldestAgeDays] = useState<number | null>(null);
  const [sort, setSort] = useState<DesignerSortKey>(() => {
    try {
      return parseSortKey(localStorage.getItem(SORT_STORAGE_KEY));
    } catch {
      return 'newest';
    }
  });

  // IDs of orders owned by this designer — used to guard the order_items realtime channel.
  const ownedOrderIds = useRef<Set<string>>(new Set());
  const reloadTimer = useRef<ReturnType<typeof setTimeout>>();
  const reloadRef = useRef<() => void>(() => {});

  /** Attach customer names + order_items to a batch of orders. */
  const hydrate = useCallback(async (rows: DesignerOrder[]): Promise<DesignerOrder[]> => {
    if (!rows.length) return [];
    const customerIds = [...new Set(rows.map((o) => o.customer_id))];
    const orderIds = rows.map((o) => o.id);

    const [{ data: profilesData }, { data: itemsData }] = await Promise.all([
      getCustomerNamesForDesigner(customerIds),
      queryDesignerOrderItemsBatch(orderIds),
    ]);

    const profileMap = new Map((profilesData || []).map((p) => [p.user_id, p]));
    const itemsByOrder = new Map<string, DesignerOrderItem[]>();
    ((itemsData as unknown as DesignerOrderItem[]) || []).forEach((item) => {
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
    const { count } = await countDesignerArchivedOrders(user.id, COMPLETED_STATUSES);
    setArchiveCount(count || 0);
  }, [user]);

  const loadActive = useCallback(async () => {
    if (!user) return;
    // Oldest-first for "الأقدم أولاً" and "المتأخرة أولاً" so overdue (old) orders
    // are always inside the page cap; newest-first is the default.
    const ascending = sort !== 'newest';
    const { data, error: qErr } = await queryDesignerActiveOrders(user.id, ACTIVE_EXCLUDE, activeLimit, ascending);

    if (qErr) {
      setError('تعذّر تحميل الطلبات. تأكد من الاتصال وحاول مرة أخرى.');
      setLoading(false);
      return;
    }
    setError(null);
    const rows = await hydrate(data as unknown as DesignerOrder[] || []);
    rows.forEach((r) => ownedOrderIds.current.add(r.id));
    setOrders(rows);
    setActiveHasMore((data?.length || 0) === activeLimit);
    setLoading(false);
  }, [user, activeLimit, sort, hydrate]);

  // True per-status counts from the whole active queue (not the page). Best-effort:
  // a count failure never blocks the list. Parallelised with loadActive.
  const loadCounts = useCallback(async () => {
    if (!user) return;
    const { data, error: qErr } = await queryDesignerActiveOrderCounts(user.id, ACTIVE_EXCLUDE, COUNT_CAP);
    if (qErr) return;
    const rows: CountableOrder[] = ((data as unknown as CountResponseRow[] | null) ?? []).map((o) => ({
      status: o.status,
      created_at: o.created_at,
      updated_at: o.updated_at,
      items: o.order_items ?? [],
    }));
    const now = Date.now();
    setCounts(aggregateActiveCounts(rows, now));
    setOldestAgeDays(oldestActiveAgeDays(rows, now));
  }, [user]);

  const loadArchive = useCallback(async () => {
    if (!user) return;
    setArchiveLoading(true);
    const { data, error: qErr } = await queryDesignerArchivedOrders(user.id, COMPLETED_STATUSES, archiveLimit);

    if (qErr) {
      setArchiveLoading(false);
      toast({ title: 'تعذّر تحميل الطلبات المكتملة', variant: 'destructive' });
      return;
    }
    const rows = await hydrate(data as unknown as DesignerOrder[] || []);
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

  // True active-queue counts (tab badges + workload strip).
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

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
    loadCounts();
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
        const newRow = payload.new as { designer_id?: string };
        const oldRow = payload.old as { designer_id?: string };
        if (newRow?.designer_id === user.id || oldRow?.designer_id === user.id) {
          if (payload.eventType === 'UPDATE' && newRow?.designer_id === user.id && oldRow?.designer_id !== user.id) {
            toast({ title: '🎨 تم تعيين طلب جديد لك!' });
          }
          scheduleReload();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
        // Ownership guard: only react to items belonging to this designer's orders.
        const orderId = (payload.new as { order_id?: string })?.order_id || (payload.old as { order_id?: string })?.order_id;
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

  // Badges read the TRUE queue counts (from loadCounts), never the paginated page.
  const getCount = (key: string) => {
    switch (key) {
      case 'archive':
        return archiveCount;
      case 'all':
        return counts.all;
      case 'assigned':
        return counts.assigned;
      case 'revisions':
        return counts.revisions;
      case 'waiting_approval':
        return counts.waiting_approval;
      case 'approved':
        return counts.approved;
      default:
        return 0;
    }
  };

  const changeSort = useCallback((next: DesignerSortKey) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — keep the in-memory choice */
    }
  }, []);

  // The server already returns newest/oldest order; "overdue first" is the only
  // client-side step, floating overdue rows to the top of the loaded (oldest-first) page.
  const sortedActive = useMemo(
    () => (sort === 'overdue' ? overdueFirst(orders, isOverdue) : orders),
    [orders, sort],
  );

  const filteredOrders = useMemo(() => {
    let src: DesignerOrder[];
    if (activeTab === 'archive') src = archived;
    else if (activeTab === 'all') src = sortedActive;
    else if (activeTab === 'assigned') src = sortedActive.filter(isNewAssigned);
    else if (activeTab === 'revisions') src = sortedActive.filter(hasRevisionItems);
    else src = sortedActive.filter((o) => o.status === activeTab);
    return src.filter((o) => matchesQuery(o, query));
  }, [activeTab, sortedActive, archived, query]);

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

        {/* Workload strip (F4) — real counts + oldest waiting order age. One subtle RTL row. */}
        {!loading && !error && counts.all > 0 && (
          <div
            dir="rtl"
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs mb-4 px-3.5 py-2.5 rounded-xl border border-border bg-muted/30"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Upload className="w-3.5 h-3.5 text-cmyk-magenta" aria-hidden />
              المعينة
              <span className="font-bold text-foreground">{counts.assigned}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Edit2 className="w-3.5 h-3.5 text-destructive" aria-hidden />
              التعديلات
              <span className="font-bold text-foreground">{counts.revisions}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-cmyk-yellow" aria-hidden />
              بانتظار الموافقة
              <span className="font-bold text-foreground">{counts.waiting_approval}</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle
                className={cn(
                  'w-3.5 h-3.5',
                  counts.overdue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/50'
                )}
                aria-hidden
              />
              المتأخرة
              <span
                className={cn(
                  'font-bold',
                  counts.overdue > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                )}
              >
                {counts.overdue}
              </span>
            </span>
            {oldestAgeDays !== null && (
              <span className="flex items-center gap-1.5 text-muted-foreground sm:ms-auto">
                <Hourglass className="w-3.5 h-3.5" aria-hidden />
                أقدم طلب بانتظارك:
                <span className="font-bold text-foreground">
                  {oldestAgeDays === 0 ? 'اليوم' : `منذ ${oldestAgeDays} يوم`}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Sort control (item 2) — segmented, choice persisted to localStorage */}
        <div className="flex items-center gap-2 mb-4" dir="rtl">
          <ArrowDownUp className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
          <div
            role="group"
            aria-label="ترتيب الطلبات"
            className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
          >
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => changeSort(opt.key)}
                aria-pressed={sort === opt.key}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors',
                  sort === opt.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
