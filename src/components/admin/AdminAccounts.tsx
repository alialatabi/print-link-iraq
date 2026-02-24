import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_LABELS, OrderStatus } from '@/data/mockData';
import { useServices, buildLabelMap } from '@/hooks/useServices';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, TrendingUp,
  Search, CheckCircle, Clock, AlertCircle,
  Receipt, Calendar, CreditCard, X, Download,
  Users, ArrowUpRight, ArrowDownRight, Wallet,
  BarChart3, PieChart, Target, Banknote, Percent,
  CalendarDays, Plus, Trash2, Pencil, Minus,
  TrendingDown, PackageCheck, CircleDollarSign
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
  } | null;
  customer_name?: string;
  customer_phone?: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  notes: string | null;
  expense_date: string;
  created_at: string;
  created_by: string;
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

const EXPENSE_CATEGORIES = ['إيجار', 'رواتب', 'مواد خام', 'صيانة', 'مصاريف تشغيلية', 'تسويق', 'نقل وتوصيل', 'عام'];

// ─── Helpers ───
const fmt = (n: number) => n.toLocaleString('en-US');

const getDateStart = (range: DateRange): Date | null => {
  const now = new Date();
  switch (range) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d; }
    case 'year': return new Date(now.getFullYear(), 0, 1);
    case 'all': return null;
  }
};

const COMPLETED = ['printed', 'delivered'];
const ACTIVE = ['submitted', 'assigned', 'design_uploaded', 'waiting_approval', 'approved', 'print_ready'];

// ─── Component ───
const AdminAccounts = () => {
  const { user } = useAuth();
  const { services } = useServices();
  const SERVICE_LABELS = buildLabelMap(services);

  // Build price & cost maps from services
  const servicePriceMap = useMemo(() => Object.fromEntries(services.map(s => [s.id, s.price])), [services]);
  const serviceCostMap = useMemo(() => Object.fromEntries(services.map(s => [s.id, s.cost])), [services]);
  const serviceMinQtyMap = useMemo(() => Object.fromEntries(services.map(s => [s.id, s.min_quantity || 1000])), [services]);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  // Expense dialog
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: 0, category: 'عام', notes: '', expense_date: new Date().toISOString().slice(0, 10) });
  const [savingExpense, setSavingExpense] = useState(false);

  // Calc order total using service price
  const calcOrderTotal = useCallback((order: OrderRow): number => {
    const serviceType = order.templates?.service_type || '';
    const price = servicePriceMap[serviceType] || 0;
    const minQ = serviceMinQtyMap[serviceType] || 1000;
    const qty = (order.details as any)?.quantity || minQ;
    return (price / minQ) * qty;
  }, [servicePriceMap, serviceMinQtyMap]);

  // Calc order cost using service cost
  const calcOrderCost = useCallback((order: OrderRow): number => {
    const serviceType = order.templates?.service_type || '';
    const cost = serviceCostMap[serviceType] || 0;
    const minQ = serviceMinQtyMap[serviceType] || 1000;
    const qty = (order.details as any)?.quantity || minQ;
    return (cost / minQ) * qty;
  }, [serviceCostMap, serviceMinQtyMap]);

  const loadOrders = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, customer_id, designer_id, status, paid_amount, payment_status, created_at, details, templates(name, service_type)')
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

  const loadExpenses = useCallback(async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false }) as any;
    setExpenses(data || []);
  }, []);

  useEffect(() => { loadOrders(); loadExpenses(); }, [loadOrders, loadExpenses]);

  // Realtime
  useEffect(() => {
    const ch1 = supabase.channel('accounts-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders()).subscribe();
    const ch2 = supabase.channel('accounts-expenses').on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadExpenses()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [loadOrders, loadExpenses]);

  // ─── Computed Stats ───
  const dateStart = useMemo(() => getDateStart(dateRange), [dateRange]);

  const dateFilteredOrders = useMemo(() => {
    if (!dateStart) return orders;
    return orders.filter(o => new Date(o.created_at) >= dateStart);
  }, [orders, dateStart]);

  const dateFilteredExpenses = useMemo(() => {
    if (!dateStart) return expenses;
    return expenses.filter(e => new Date(e.expense_date) >= dateStart);
  }, [expenses, dateStart]);

  const activeOrders = useMemo(() =>
    dateFilteredOrders.filter(o => o.status !== 'cancelled' && o.status !== 'draft'),
    [dateFilteredOrders]
  );

  const completedOrders = useMemo(() => activeOrders.filter(o => COMPLETED.includes(o.status)), [activeOrders]);
  const pendingOrders = useMemo(() => activeOrders.filter(o => ACTIVE.includes(o.status)), [activeOrders]);

  // Revenue (sales) = sum of service price × qty for completed orders
  const totalSales = useMemo(() => completedOrders.reduce((s, o) => s + calcOrderTotal(o), 0), [completedOrders, calcOrderTotal]);
  // Production cost = sum of service cost × qty for completed orders
  const totalProductionCost = useMemo(() => completedOrders.reduce((s, o) => s + calcOrderCost(o), 0), [completedOrders, calcOrderCost]);
  // Total expenses (manual)
  const totalExpenses = useMemo(() => dateFilteredExpenses.reduce((s, e) => s + e.amount, 0), [dateFilteredExpenses]);
  // Gross profit
  const grossProfit = totalSales - totalProductionCost;
  // Net profit
  const netProfit = grossProfit - totalExpenses;
  // Gross margin
  const grossMargin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;
  // Net margin
  const netMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0;

  // Collection
  const confirmedPaid = useMemo(() => completedOrders.reduce((s, o) => s + o.paid_amount, 0), [completedOrders]);
  const confirmedRemaining = totalSales - confirmedPaid;
  const collectionRate = totalSales > 0 ? Math.round((confirmedPaid / totalSales) * 100) : 0;

  // Pending value
  const pendingValue = useMemo(() => pendingOrders.reduce((s, o) => s + calcOrderTotal(o), 0), [pendingOrders, calcOrderTotal]);

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
  }, [completedOrders, calcOrderTotal]);

  // Service breakdown with cost
  const serviceRevenue = useMemo(() => {
    const map = new Map<string, { key: string; label: string; revenue: number; cost: number; profit: number; count: number; pending: number }>();
    activeOrders.forEach(o => {
      const key = o.templates?.service_type || 'unknown';
      const prev = map.get(key) || { key, label: SERVICE_LABELS[key] || key, revenue: 0, cost: 0, profit: 0, count: 0, pending: 0 };
      const rev = calcOrderTotal(o);
      const cst = calcOrderCost(o);
      if (COMPLETED.includes(o.status)) {
        prev.revenue += rev;
        prev.cost += cst;
        prev.profit += (rev - cst);
      } else {
        prev.pending += rev;
      }
      prev.count += 1;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [activeOrders, SERVICE_LABELS, calcOrderTotal, calcOrderCost]);

  // Expense by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    dateFilteredExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [dateFilteredExpenses]);

  // Payment stats
  const paidCount = activeOrders.filter(o => o.payment_status === 'paid').length;
  const unpaidCount = activeOrders.filter(o => o.payment_status === 'unpaid').length;
  const partialCount = activeOrders.filter(o => o.payment_status === 'partial').length;

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months: { label: string; revenue: number; cost: number; profit: number; expenses: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const monthOrders = orders.filter(o => {
        const od = new Date(o.created_at);
        return od >= d && od <= end && COMPLETED.includes(o.status);
      });
      const monthExpenses = expenses.filter(e => {
        const ed = new Date(e.expense_date);
        return ed >= d && ed <= end;
      });
      const rev = monthOrders.reduce((s, o) => s + calcOrderTotal(o), 0);
      const cst = monthOrders.reduce((s, o) => s + calcOrderCost(o), 0);
      const exp = monthExpenses.reduce((s, e) => s + e.amount, 0);
      months.push({
        label: d.toLocaleDateString('ar-IQ', { month: 'short' }),
        revenue: rev,
        cost: cst,
        profit: rev - cst - exp,
        expenses: exp,
        orders: monthOrders.length,
      });
    }
    return months;
  }, [orders, expenses, calcOrderTotal, calcOrderCost]);

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

  // Expense CRUD
  const openAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({ title: '', amount: 0, category: 'عام', notes: '', expense_date: new Date().toISOString().slice(0, 10) });
    setExpenseDialogOpen(true);
  };

  const openEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseForm({ title: exp.title, amount: exp.amount, category: exp.category, notes: exp.notes || '', expense_date: exp.expense_date.slice(0, 10) });
    setExpenseDialogOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.title.trim()) { toast.error('عنوان المصروف مطلوب'); return; }
    if (expenseForm.amount <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
    setSavingExpense(true);
    try {
      if (editingExpense) {
        const { error } = await supabase.from('expenses').update({
          title: expenseForm.title,
          amount: expenseForm.amount,
          category: expenseForm.category,
          notes: expenseForm.notes || null,
          expense_date: expenseForm.expense_date,
        } as any).eq('id', editingExpense.id);
        if (error) throw error;
        toast.success('تم تحديث المصروف');
      } else {
        const { error } = await supabase.from('expenses').insert({
          title: expenseForm.title,
          amount: expenseForm.amount,
          category: expenseForm.category,
          notes: expenseForm.notes || null,
          expense_date: expenseForm.expense_date,
          created_by: user?.id,
        } as any);
        if (error) throw error;
        toast.success('تمت إضافة المصروف');
      }
      setExpenseDialogOpen(false);
      loadExpenses();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('حذف هذا المصروف؟')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast.error('فشل الحذف'); return; }
    toast.success('تم الحذف');
    loadExpenses();
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
      'المبيعات': calcOrderTotal(o),
      'التكلفة': calcOrderCost(o),
      'الربح': calcOrderTotal(o) - calcOrderCost(o),
      'المدفوع': o.paid_amount,
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

      {/* ═══ P&L KPI Cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'إجمالي المبيعات',
            value: fmt(totalSales),
            sub: `${completedOrders.length} طلب مكتمل`,
            icon: DollarSign,
            iconBg: 'bg-primary/10',
            iconColor: 'text-primary',
          },
          {
            label: 'تكلفة الإنتاج',
            value: fmt(totalProductionCost),
            sub: `تكلفة الطلبات المكتملة`,
            icon: PackageCheck,
            iconBg: 'bg-destructive/10',
            iconColor: 'text-destructive',
            valueColor: 'text-destructive',
          },
          {
            label: 'الربح الإجمالي',
            value: fmt(grossProfit),
            sub: `هامش الربح: ${grossMargin}%`,
            icon: TrendingUp,
            iconBg: 'bg-success/10',
            iconColor: 'text-success',
            valueColor: grossProfit > 0 ? 'text-success' : 'text-destructive',
          },
          {
            label: 'المصروفات',
            value: fmt(totalExpenses),
            sub: `${dateFilteredExpenses.length} مصروف`,
            icon: Minus,
            iconBg: 'bg-destructive/10',
            iconColor: 'text-destructive',
            valueColor: 'text-destructive',
          },
          {
            label: 'صافي الربح',
            value: fmt(netProfit),
            sub: `صافي الهامش: ${netMargin}%`,
            icon: CircleDollarSign,
            iconBg: netProfit >= 0 ? 'bg-success/10' : 'bg-destructive/10',
            iconColor: netProfit >= 0 ? 'text-success' : 'text-destructive',
            valueColor: netProfit >= 0 ? 'text-success' : 'text-destructive',
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

      {/* ═══ Secondary KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'المبالغ المستلمة', value: fmt(confirmedPaid), sub: confirmedRemaining > 0 ? `متبقي: ${fmt(confirmedRemaining)} د.ع` : 'تم التحصيل', icon: Wallet, iconBg: 'bg-success/10', iconColor: 'text-success', valueColor: 'text-success' },
          { label: 'الطلبات المعلقة', value: fmt(pendingValue), sub: `${pendingOrders.length} طلب قيد المعالجة`, icon: Clock, iconBg: 'bg-accent/10', iconColor: 'text-accent-foreground' },
          { label: 'متوسط قيمة الطلب', value: fmt(completedOrders.length > 0 ? Math.round(totalSales / completedOrders.length) : 0), sub: `نسبة التحصيل: ${collectionRate}%`, icon: Target, iconBg: 'bg-primary/10', iconColor: 'text-primary' },
          { label: 'متوسط الربح / طلب', value: fmt(completedOrders.length > 0 ? Math.round(grossProfit / completedOrders.length) : 0), sub: `صافي ربح لكل طلب`, icon: BarChart3, iconBg: 'bg-success/10', iconColor: 'text-success', valueColor: 'text-success' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
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
        <div className="lg:col-span-2 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              الأداء الشهري
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
                      className="absolute bottom-0 w-full bg-success rounded-t-md transition-all duration-500"
                      style={{ height: m.revenue > 0 ? `${(m.profit / m.revenue) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
                <span className="text-[9px] text-success font-bold">{m.profit > 0 ? fmt(m.profit) : ''}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-success" />
              <span className="text-[10px] text-muted-foreground">صافي الربح</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-primary/15" />
              <span className="text-[10px] text-muted-foreground">المبيعات</span>
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
              <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
              <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--success))" strokeWidth="3" strokeDasharray={`${collectionRate}, 100`} className="transition-all duration-1000" />
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

      {/* ═══ Tabs: الطلبات / المصروفات ═══ */}
      <Tabs defaultValue="orders" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="orders" className="flex items-center gap-2 text-xs">
            <Receipt className="w-3.5 h-3.5" />
            الطلبات والمدفوعات
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2 text-xs">
            <Minus className="w-3.5 h-3.5" />
            المصروفات ({dateFilteredExpenses.length})
          </TabsTrigger>
        </TabsList>

        {/* ═══ Orders Tab ═══ */}
        <TabsContent value="orders">
          {/* Service Breakdown + Top Customers + Payment Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Service Revenue with cost */}
            <div className="lg:col-span-1">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                الأداء حسب الخدمة
              </h4>
              {serviceRevenue.length > 0 ? (
                <div className="bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 divide-y divide-border/50">
                  {serviceRevenue.map(s => (
                    <div key={s.key} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-foreground">{s.label}</span>
                        <Badge variant="secondary" className="text-[10px]">{s.count}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div>
                          <p className="text-[9px] text-muted-foreground">مبيعات</p>
                          <p className="text-[10px] font-bold text-foreground">{fmt(s.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">تكلفة</p>
                          <p className="text-[10px] font-bold text-destructive">{fmt(s.cost)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground">ربح</p>
                          <p className="text-[10px] font-bold text-success">{fmt(s.profit)}</p>
                        </div>
                      </div>
                      {s.pending > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">معلق: {fmt(s.pending)} د.ع</p>
                      )}
                    </div>
                  ))}
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
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{i + 1}</div>
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

          {/* Orders Table */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Banknote className="w-4 h-4 text-primary" />
                تفاصيل الطلبات
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{filtered.length} سجل</span>
                <Button onClick={handleExportCSV} variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
                  <Download className="w-3.5 h-3.5" />
                  تصدير CSV
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو رقم الطلب..." className="pr-9 h-9 text-xs rounded-lg" />
              </div>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg"><SelectValue placeholder="الخدمة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الخدمات</SelectItem>
                  {services.map(s => (<SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg"><SelectValue placeholder="حالة الطلب" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'draft').map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg"><SelectValue placeholder="ترتيب" /></SelectTrigger>
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
                        <TableHead className="text-right text-[11px] font-semibold w-[140px]">الزبون</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold">القالب</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[60px]">الكمية</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[80px]">المبيعات</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[70px]">التكلفة</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[70px]">الربح</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[80px]">المدفوع</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[70px]">الدفع</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[110px]">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((order) => {
                        const orderTotal = calcOrderTotal(order);
                        const orderCost = calcOrderCost(order);
                        const orderProfit = orderTotal - orderCost;
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
                              <span className="text-xs font-bold text-foreground">{orderTotal > 0 ? fmt(orderTotal) : '-'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-destructive">{orderCost > 0 ? fmt(orderCost) : '-'}</span>
                            </TableCell>
                            <TableCell>
                              <span className={`text-xs font-bold ${orderProfit > 0 ? 'text-success' : 'text-destructive'}`}>
                                {orderTotal > 0 ? fmt(orderProfit) : '-'}
                              </span>
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
                                  <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-20 h-7 text-[11px] rounded" placeholder="المبلغ" min="0" autoFocus />
                                  <Button size="sm" className="h-7 text-[10px] px-2 rounded" onClick={() => handleUpdatePayment(order.id, parseInt(editAmount) || 0, orderTotal)}>✓</Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1.5 rounded" onClick={() => setEditingPayment(null)}>✗</Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                  {order.payment_status !== 'paid' && orderTotal > 0 && (
                                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded" onClick={() => handleMarkPaid(order.id, orderTotal)}>
                                      <CheckCircle className="w-3 h-3 ml-0.5" />
                                      دفع
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 rounded" onClick={() => { setEditingPayment(order.id); setEditAmount(order.paid_amount.toString()); }}>
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
        </TabsContent>

        {/* ═══ Expenses Tab ═══ */}
        <TabsContent value="expenses">
          <div className="space-y-4">
            {/* Expense category breakdown */}
            {expenseByCategory.length > 0 && (
              <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5">
                <h4 className="text-sm font-bold text-foreground mb-4">توزيع المصروفات حسب الفئة</h4>
                <div className="space-y-2">
                  {expenseByCategory.map(([cat, amount]) => {
                    const pct = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-foreground font-medium">{cat}</span>
                          <span className="text-muted-foreground">{fmt(amount)} د.ع ({Math.round(pct)}%)</span>
                        </div>
                        <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                          <div className="bg-destructive h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add expense button */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">سجل المصروفات</h3>
              <Button onClick={openAddExpense} size="sm" className="rounded-xl gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                إضافة مصروف
              </Button>
            </div>

            {/* Expenses list */}
            {dateFilteredExpenses.length === 0 ? (
              <div className="text-center py-16 bg-card/80 rounded-2xl border border-border/50">
                <Minus className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">لا توجد مصروفات في هذه الفترة</p>
              </div>
            ) : (
              <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-right text-[11px] font-semibold">العنوان</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[100px]">الفئة</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[100px]">المبلغ</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[100px]">التاريخ</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold w-[80px]">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dateFilteredExpenses.map(exp => (
                        <TableRow key={exp.id} className="group">
                          <TableCell>
                            <p className="text-xs font-medium text-foreground">{exp.title}</p>
                            {exp.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{exp.notes}</p>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{exp.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-bold text-destructive">{fmt(exp.amount)} د.ع</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-[11px] text-muted-foreground">{new Date(exp.expense_date).toLocaleDateString('ar-IQ')}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditExpense(exp)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteExpense(exp.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ Expense Dialog ═══ */}
      <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'تعديل مصروف' : 'إضافة مصروف'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">العنوان *</label>
              <Input
                value={expenseForm.title}
                onChange={e => setExpenseForm(f => ({ ...f, title: e.target.value }))}
                placeholder="مثال: إيجار المحل"
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">المبلغ (د.ع) *</label>
                <Input
                  type="number"
                  value={expenseForm.amount || ''}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))}
                  placeholder="500000"
                  className="rounded-xl"
                  dir="ltr"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">التاريخ</label>
                <Input
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))}
                  className="rounded-xl"
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">الفئة</label>
              <Select value={expenseForm.category} onValueChange={v => setExpenseForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">ملاحظات</label>
              <Textarea
                value={expenseForm.notes}
                onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات إضافية..."
                className="rounded-xl min-h-[60px]"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveExpense} disabled={savingExpense} className="flex-1 rounded-xl">
                {savingExpense ? 'جاري الحفظ...' : editingExpense ? 'حفظ التغييرات' : 'إضافة'}
              </Button>
              <Button variant="outline" onClick={() => setExpenseDialogOpen(false)} disabled={savingExpense} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAccounts;
