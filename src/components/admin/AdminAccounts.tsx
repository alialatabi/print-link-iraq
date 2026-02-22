import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_LABELS, OrderStatus } from '@/data/mockData';
import { useServices, buildLabelMap } from '@/hooks/useServices';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, TrendingUp, TrendingDown,
  Search, CheckCircle, Clock, AlertCircle,
  Receipt, Calendar, CreditCard, X, Download,
  Users, ArrowUpRight, ArrowDownRight, Wallet,
  BarChart3, PieChart, Target, Banknote, Percent,
  CalendarDays, Filter
} from 'lucide-react';

// ─── Types ───
interface OrderRow {
  id: string;
  customer_id: string;
  designer_id: string | null;
  status: string;
  paid_amount: number;
  payment_status: string;
  created_at: string;
  details: Record<string, any> | null;
  templates: {
    name: string;
    service_type: string;
    price: number | null;
  } | null;
  // joined from profiles
  customer_name?: string;
  customer_phone?: string;
}

// ─── Constants ───
const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'غير مدفوع',
  partial: 'جزئي',
  paid: 'مدفوع',
};

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
  partial: 'bg-accent/15 text-accent-foreground border-accent/30',
  paid: 'bg-success/10 text-success border-success/20',
};

type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'اليوم',
  week: 'هذا الأسبوع',
  month: 'هذا الشهر',
  quarter: 'آخر 3 أشهر',
  year: 'هذه السنة',
  all: 'الكل',
};

// ─── Helpers ───
const fmt = (n: number) => n.toLocaleString('en-US');

const calcOrderTotal = (order: OrderRow): number => {
  const price = order.templates?.price || 0;
  const qty = (order.details as any)?.quantity || 1000;
  return (price / 1000) * qty;
};

const getDateStart = (range: DateRange): Date | null => {
  const now = new Date();
  switch (range) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    case 'year': return new Date(now.getFullYear(), 0, 1);
    case 'all': return null;
  }
};

const COMPLETED = ['printed', 'delivered'];
const ACTIVE = ['submitted', 'assigned', 'design_uploaded', 'waiting_approval', 'approved', 'print_ready'];

// ─── Component ───
const AdminAccounts = () => {
  const { services } = useServices();
  const SERVICE_LABELS = buildLabelMap(services);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const loadOrders = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, customer_id, designer_id, status, paid_amount, payment_status, created_at, details, templates(name, service_type, price)')
      .order('created_at', { ascending: false });

    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const customerIds = [...new Set(ordersData.map(o => o.customer_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, display_name, phone')
      .in('user_id', customerIds);

    const profileMap = new Map((profilesData || []).map(p => [p.user_id, p]));

    const enriched = ordersData.map(o => {
      const profile = profileMap.get(o.customer_id);
      return {
        ...o,
        details: (o.details || {}) as Record<string, any>,
        templates: o.templates as OrderRow['templates'],
        customer_name: profile?.display_name || null,
        customer_phone: profile?.phone || null,
      } as OrderRow;
    });

    setOrders(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('accounts-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadOrders]);

  // ─── Computed Stats ───
  const dateStart = useMemo(() => getDateStart(dateRange), [dateRange]);

  const dateFilteredOrders = useMemo(() => {
    if (!dateStart) return orders;
    return orders.filter(o => new Date(o.created_at) >= dateStart);
  }, [orders, dateStart]);

  // Non-cancelled orders for stats
  const activeOrders = useMemo(() =>
    dateFilteredOrders.filter(o => o.status !== 'cancelled' && o.status !== 'draft'),
    [dateFilteredOrders]
  );

  const completedOrders = useMemo(() => activeOrders.filter(o => COMPLETED.includes(o.status)), [activeOrders]);
  const pendingOrders = useMemo(() => activeOrders.filter(o => ACTIVE.includes(o.status)), [activeOrders]);

  // Revenue = sum of actual totals (price × qty) for completed orders
  const confirmedRevenue = useMemo(() => completedOrders.reduce((s, o) => s + calcOrderTotal(o), 0), [completedOrders]);
  const confirmedPaid = useMemo(() => completedOrders.reduce((s, o) => s + o.paid_amount, 0), [completedOrders]);
  const confirmedRemaining = confirmedRevenue - confirmedPaid;
  const collectionRate = confirmedRevenue > 0 ? Math.round((confirmedPaid / confirmedRevenue) * 100) : 0;

  // Pending value
  const pendingValue = useMemo(() => pendingOrders.reduce((s, o) => s + calcOrderTotal(o), 0), [pendingOrders]);

  // Average order value
  const avgOrderValue = completedOrders.length > 0 ? Math.round(confirmedRevenue / completedOrders.length) : 0;

  // Top customers
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; paid: number }>();
    completedOrders.forEach(o => {
      const key = o.customer_id;
      const prev = map.get(key) || { name: o.customer_name || '-', total: 0, count: 0, paid: 0 };
      prev.total += calcOrderTotal(o);
      prev.paid += o.paid_amount;
      prev.count += 1;
      prev.name = o.customer_name || prev.name;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [completedOrders]);

  // Service breakdown
  const serviceRevenue = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; paid: number; count: number; pending: number }>();
    activeOrders.forEach(o => {
      const key = o.templates?.service_type || 'unknown';
      const prev = map.get(key) || { key, label: SERVICE_LABELS[key] || key, total: 0, paid: 0, count: 0, pending: 0 };
      const total = calcOrderTotal(o);
      if (COMPLETED.includes(o.status)) {
        prev.total += total;
        prev.paid += o.paid_amount;
      } else {
        prev.pending += total;
      }
      prev.count += 1;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [activeOrders, SERVICE_LABELS]);

  // Payment stats
  const paidCount = activeOrders.filter(o => o.payment_status === 'paid').length;
  const unpaidCount = activeOrders.filter(o => o.payment_status === 'unpaid').length;
  const partialCount = activeOrders.filter(o => o.payment_status === 'partial').length;

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { label: string; revenue: number; paid: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthOrders = orders.filter(o => {
        const od = new Date(o.created_at);
        return od >= d && od <= end && COMPLETED.includes(o.status);
      });
      months.push({
        label: d.toLocaleDateString('ar-IQ', { month: 'short' }),
        revenue: monthOrders.reduce((s, o) => s + calcOrderTotal(o), 0),
        paid: monthOrders.reduce((s, o) => s + o.paid_amount, 0),
        orders: monthOrders.length,
      });
    }
    return months;
  }, [orders]);

  // Current vs prev month comparison
  const currentMonthRevenue = monthlyTrend[5]?.revenue || 0;
  const prevMonthRevenue = monthlyTrend[4]?.revenue || 0;
  const monthGrowth = prevMonthRevenue > 0 ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : 0;

  // ─── Filtering ───
  let filtered = dateFilteredOrders.filter(o => o.status !== 'draft');
  if (paymentFilter !== 'all') filtered = filtered.filter(o => o.payment_status === paymentFilter);
  if (serviceFilter !== 'all') filtered = filtered.filter(o => o.templates?.service_type === serviceFilter);
  if (statusFilter !== 'all') filtered = filtered.filter(o => o.status === statusFilter);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(o =>
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').includes(q) ||
      o.id.toLowerCase().includes(q) ||
      (o.templates?.name || '').toLowerCase().includes(q)
    );
  }
  if (sortBy === 'oldest') filtered = [...filtered].reverse();
  if (sortBy === 'highest') filtered = [...filtered].sort((a, b) => calcOrderTotal(b) - calcOrderTotal(a));
  if (sortBy === 'lowest') filtered = [...filtered].sort((a, b) => calcOrderTotal(a) - calcOrderTotal(b));
  if (sortBy === 'unpaid_first') filtered = [...filtered].sort((a, b) => {
    const order = { unpaid: 0, partial: 1, paid: 2 };
    return (order[a.payment_status as keyof typeof order] ?? 3) - (order[b.payment_status as keyof typeof order] ?? 3);
  });

  // ─── Actions ───
  const handleUpdatePayment = async (orderId: string, amount: number, orderTotal: number) => {
    const paidAmount = Math.max(0, amount);
    let paymentStatus = 'unpaid';
    if (paidAmount >= orderTotal && orderTotal > 0) paymentStatus = 'paid';
    else if (paidAmount > 0) paymentStatus = 'partial';

    const { error } = await supabase
      .from('orders')
      .update({ paid_amount: paidAmount, payment_status: paymentStatus } as any)
      .eq('id', orderId);

    if (error) { toast.error('فشل تحديث الدفع'); return; }
    toast.success('تم تحديث المبلغ المدفوع');
    setEditingPayment(null);
    loadOrders();
  };

  const handleMarkPaid = async (orderId: string, orderTotal: number) => {
    await handleUpdatePayment(orderId, orderTotal, orderTotal);
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    const rows = filtered.map((o, i) => ({
      '#': i + 1,
      'رقم الطلب': o.id.slice(0, 8).toUpperCase(),
      'الزبون': o.customer_name || '-',
      'الهاتف': o.customer_phone || '-',
      'الخدمة': SERVICE_LABELS[o.templates?.service_type || ''] || '-',
      'القالب': o.templates?.name || '-',
      'الكمية': (o.details as any)?.quantity || 1000,
      'الإجمالي': calcOrderTotal(o),
      'المدفوع': o.paid_amount,
      'المتبقي': calcOrderTotal(o) - o.paid_amount,
      'حالة الدفع': PAYMENT_LABELS[o.payment_status] || o.payment_status,
      'حالة الطلب': STATUS_LABELS[o.status as OrderStatus] || o.status,
      'التاريخ': new Date(o.created_at).toLocaleDateString('ar-IQ'),
    }));
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String((r as any)[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `حسابات_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${filtered.length} سجل`);
  };

  // ─── Max bar for mini chart ───
  const maxMonthRevenue = Math.max(...monthlyTrend.map(m => m.revenue), 1);

  if (loading) return (
    <div className="py-16 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ═══ Date Range Selector ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">الفترة الزمنية</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map(key => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                dateRange === key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {DATE_RANGE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'الإيرادات المؤكدة',
            value: fmt(confirmedRevenue),
            sub: `${completedOrders.length} طلب مكتمل`,
            icon: DollarSign,
            iconBg: 'bg-primary/10',
            iconColor: 'text-primary',
          },
          {
            label: 'المبالغ المستلمة',
            value: fmt(confirmedPaid),
            sub: confirmedRemaining > 0 ? `متبقي: ${fmt(confirmedRemaining)} د.ع` : 'تم التحصيل بالكامل',
            icon: Wallet,
            iconBg: 'bg-success/10',
            iconColor: 'text-success',
            valueColor: 'text-success',
          },
          {
            label: 'الطلبات المعلقة',
            value: fmt(pendingValue),
            sub: `${pendingOrders.length} طلب قيد المعالجة`,
            icon: Clock,
            iconBg: 'bg-accent/10',
            iconColor: 'text-accent-foreground',
          },
          {
            label: 'متوسط قيمة الطلب',
            value: fmt(avgOrderValue),
            sub: `نسبة التحصيل: ${collectionRate}%`,
            icon: Target,
            iconBg: 'bg-primary/10',
            iconColor: 'text-primary',
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight">{stat.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center shrink-0`}>
                    <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                  </div>
                </div>
                <p className={`text-xl font-extrabold ${stat.valueColor || 'text-foreground'} leading-none`}>
                  {stat.value} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1.5">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ═══ Monthly Trend + Collection Rate ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Mini Bar Chart - Monthly Trend */}
        <div className="lg:col-span-2 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              الإيرادات الشهرية
            </h4>
            {monthGrowth !== 0 && (
              <div className={`flex items-center gap-1 text-xs font-semibold ${monthGrowth > 0 ? 'text-success' : 'text-destructive'}`}>
                {monthGrowth > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {Math.abs(monthGrowth)}% عن الشهر السابق
              </div>
            )}
          </div>
          <div className="flex items-end gap-2 h-32">
            {monthlyTrend.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-foreground">{m.revenue > 0 ? fmt(m.revenue) : ''}</span>
                <div className="w-full relative">
                  <div
                    className="w-full bg-primary/15 rounded-t-md transition-all duration-500 relative overflow-hidden"
                    style={{ height: `${Math.max((m.revenue / maxMonthRevenue) * 80, 4)}px` }}
                  >
                    <div
                      className="absolute bottom-0 w-full bg-primary rounded-t-md transition-all duration-500"
                      style={{ height: m.revenue > 0 ? `${(m.paid / m.revenue) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
                <span className="text-[9px] text-muted-foreground">{m.orders} طلب</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-primary" />
              <span className="text-[10px] text-muted-foreground">مستلم</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-primary/15" />
              <span className="text-[10px] text-muted-foreground">الإجمالي</span>
            </div>
          </div>
        </div>

        {/* Collection Rate Donut */}
        <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5 flex flex-col items-center justify-center">
          <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Percent className="w-4 h-4 text-success" />
            نسبة التحصيل
          </h4>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="hsl(var(--success))"
                strokeWidth="3"
                strokeDasharray={`${collectionRate}, 100`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-success">{collectionRate}%</span>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 w-full">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">مستلم</span>
              <span className="font-bold text-success">{fmt(confirmedPaid)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">متبقي</span>
              <span className="font-bold text-destructive">{fmt(confirmedRemaining)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Service Breakdown + Top Customers + Payment Status ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Service Revenue */}
        <div className="lg:col-span-1">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" />
            الإيرادات حسب الخدمة
          </h4>
          {serviceRevenue.length > 0 ? (
            <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 divide-y divide-border/50">
              {serviceRevenue.map(s => {
                const pct = s.total > 0 ? (s.paid / s.total) * 100 : 0;
                return (
                  <div key={s.key} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-foreground">{s.label}</span>
                      <Badge variant="secondary" className="text-[10px]">{s.count}</Badge>
                    </div>
                    <div className="bg-muted rounded-full h-1.5 overflow-hidden mb-1">
                      <div className="bg-success h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-success font-bold">{fmt(s.paid)}</span>
                      <span className="text-[10px] text-muted-foreground">/ {fmt(s.total)} د.ع</span>
                    </div>
                    {s.pending > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">معلق: {fmt(s.pending)} د.ع</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card/80 rounded-xl border border-border/50 p-8 text-center text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>

        {/* Top Customers */}
        <div className="lg:col-span-1">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            أكثر الزبائن إنفاقاً
          </h4>
          {topCustomers.length > 0 ? (
            <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 divide-y divide-border/50">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.count} طلب</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-xs font-bold text-foreground">{fmt(c.total)}</p>
                    <p className="text-[10px] text-success">{fmt(c.paid)} مستلم</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card/80 rounded-xl border border-border/50 p-8 text-center text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>

        {/* Payment Status */}
        <div className="lg:col-span-1">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            حالة الدفع
          </h4>
          <div className="space-y-2">
            {[
              { key: 'paid', label: 'مدفوع بالكامل', count: paidCount, color: 'border-success/30 bg-success/5', dotColor: 'bg-success' },
              { key: 'partial', label: 'مدفوع جزئياً', count: partialCount, color: 'border-accent/30 bg-accent/5', dotColor: 'bg-accent' },
              { key: 'unpaid', label: 'غير مدفوع', count: unpaidCount, color: 'border-destructive/30 bg-destructive/5', dotColor: 'bg-destructive' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setPaymentFilter(paymentFilter === s.key ? 'all' : s.key)}
                className={`w-full flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                  paymentFilter === s.key ? s.color + ' ring-1 ring-ring' : 'border-border/50 bg-card/80 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${s.dotColor}`} />
                  <span className="text-sm text-foreground">{s.label}</span>
                </div>
                <span className="text-lg font-bold text-foreground">{s.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Orders Table ═══ */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-4 h-4 text-primary" />
            تفاصيل المدفوعات
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{filtered.length} سجل</span>
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
              <Download className="w-3.5 h-3.5" />
              تصدير CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف أو رقم الطلب..."
              className="pr-9 h-9 text-xs rounded-lg"
            />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg">
              <SelectValue placeholder="الخدمة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الخدمات</SelectItem>
              {services.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg">
              <SelectValue placeholder="حالة الطلب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'draft').map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg">
              <SelectValue placeholder="ترتيب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث</SelectItem>
              <SelectItem value="oldest">الأقدم</SelectItem>
              <SelectItem value="highest">الأعلى قيمة</SelectItem>
              <SelectItem value="lowest">الأقل قيمة</SelectItem>
              <SelectItem value="unpaid_first">غير المدفوع أولاً</SelectItem>
            </SelectContent>
          </Select>
          {(paymentFilter !== 'all' || searchQuery || serviceFilter !== 'all' || statusFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setPaymentFilter('all'); setSearchQuery(''); setServiceFilter('all'); setStatusFilter('all'); }}>
              <X className="w-3 h-3 ml-1" /> مسح الفلاتر
            </Button>
          )}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-card/80 rounded-2xl border border-border/50">
            <DollarSign className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد سجلات مطابقة</p>
          </div>
        ) : (
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-right text-[11px] font-semibold w-[160px]">الزبون</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold">القالب</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[70px]">الكمية</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[70px]">الحالة</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[90px]">الإجمالي</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[90px]">المدفوع</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[80px]">الدفع</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[110px]">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => {
                    const orderTotal = calcOrderTotal(order);
                    const remaining = orderTotal - order.paid_amount;
                    const isEditing = editingPayment === order.id;
                    const qty = (order.details as any)?.quantity || 1000;

                    return (
                      <TableRow key={order.id} className="group">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-foreground leading-tight">{order.customer_name || '-'}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">#{order.id.slice(0, 8)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-foreground">{order.templates?.name || '-'}</p>
                          <p className="text-[10px] text-muted-foreground">{SERVICE_LABELS[order.templates?.service_type || ''] || ''}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-foreground">{fmt(qty)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[order.status as OrderStatus] || order.status}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-bold text-foreground">{orderTotal > 0 ? fmt(orderTotal) : '-'}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="text-xs font-bold text-success">{fmt(order.paid_amount)}</span>
                            {remaining > 0 && order.payment_status !== 'paid' && (
                              <p className="text-[10px] text-destructive">-{fmt(remaining)}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${PAYMENT_COLORS[order.payment_status]}`}>
                            {PAYMENT_LABELS[order.payment_status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={editAmount}
                                onChange={e => setEditAmount(e.target.value)}
                                className="w-20 h-7 text-[11px] rounded"
                                placeholder="المبلغ"
                                min="0"
                                autoFocus
                              />
                              <Button size="sm" className="h-7 text-[10px] px-2 rounded" onClick={() => handleUpdatePayment(order.id, parseInt(editAmount) || 0, orderTotal)}>
                                ✓
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1.5 rounded" onClick={() => setEditingPayment(null)}>
                                ✗
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                              {order.payment_status !== 'paid' && orderTotal > 0 && (
                                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded" onClick={() => handleMarkPaid(order.id, orderTotal)}>
                                  <CheckCircle className="w-3 h-3 ml-0.5" />
                                  دفع
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px] px-2 rounded"
                                onClick={() => { setEditingPayment(order.id); setEditAmount(order.paid_amount.toString()); }}
                              >
                                تعديل
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAccounts;
