import { useEffect, useState, useCallback, useMemo } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { buildCatalog, computeLine } from '@/lib/orderPricing';
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
  TrendingDown, PackageCheck, CircleDollarSign, Sparkles, Megaphone
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

interface OrderItemRow {
  id: string;
  order_id: string;
  status: string | null;
  details: Record<string, any> | null;
  template_id: string | null;
  templates: { service_type: string } | null;
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

// A fixed monthly commitment (rent, salaries…). Counted per-month in the P&L.
interface RecurringExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  notes: string | null;
  active: boolean;
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

// NOTE: 'مواد خام' (raw materials / production cost) is intentionally NOT suggested here.
// Production cost is now counted automatically per order via per-line cost snapshots.
// Expenses recorded here are OPERATING expenses only (rent, salaries, marketing…).
const EXPENSE_CATEGORIES = ['إيجار', 'رواتب', 'صيانة', 'مصاريف تشغيلية', 'تسويق', 'نقل وتوصيل', 'عام'];

// The category that counts as marketing spend (drives the marketing section).
const MARKETING_CATEGORY = 'تسويق';

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

  // Catalog used as a fallback for legacy rows without a stored pricing snapshot.
  const catalog = useMemo(() => buildCatalog(services), [services]);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  // Child line items keyed by parent order id (cart orders). Single-template /
  // reseller / upload / AI-direct orders have no entry here.
  const [orderItemsByOrder, setOrderItemsByOrder] = useState<Map<string, OrderItemRow[]>>(new Map());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  // Real AI generation spend (IQD) for the selected period, from ai_usage_by_customer.
  const [aiCost, setAiCost] = useState(0);
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
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // Recurring (fixed monthly) expenses
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [recurringForm, setRecurringForm] = useState({ title: '', amount: 0, category: 'إيجار', notes: '', active: true });
  const [savingRecurring, setSavingRecurring] = useState(false);
  const [recurringToDelete, setRecurringToDelete] = useState<RecurringExpense | null>(null);
  const [deletingRecurring, setDeletingRecurring] = useState(false);

  // Resolve all revenue lines for an order. Cart orders (with order_items) sum
  // over their child lines; everything else resolves the single `orders` row.
  // Each line prefers its stored `details.pricing` snapshot and only falls back
  // to the live catalog for legacy rows.
  const linesOf = useCallback((order: OrderRow) => {
    const items = orderItemsByOrder.get(order.id);
    if (items && items.length > 0) {
      return items.map(it => computeLine(it.details, catalog, it.templates?.service_type || ''));
    }
    return [computeLine(order.details, catalog, order.templates?.service_type || '')];
  }, [orderItemsByOrder, catalog]);

  // Order revenue = sum of line revenues.
  const revenueOf = useCallback((order: OrderRow): number =>
    linesOf(order).reduce((s, l) => s + l.revenue, 0), [linesOf]);

  // Order COGS = sum of line costs.
  const costOf = useCallback((order: OrderRow): number =>
    linesOf(order).reduce((s, l) => s + l.cost, 0), [linesOf]);

  // Total quantity across an order's lines (for the table + CSV).
  const quantityOf = useCallback((order: OrderRow): number =>
    linesOf(order).reduce((s, l) => s + (l.quantity || 0), 0), [linesOf]);

  // Distinct service types touched by an order (for the "متعدد" label).
  const serviceTypesOf = useCallback((order: OrderRow): string[] =>
    [...new Set(linesOf(order).map(l => l.serviceType).filter(Boolean))], [linesOf]);

  const loadOrders = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, customer_id, designer_id, status, paid_amount, payment_status, created_at, details, templates(name, service_type)')
      .order('created_at', { ascending: false });

    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      setOrderItemsByOrder(new Map());
      setLoading(false);
      return;
    }

    // Fetch child line items for these orders (cart orders). Service type is
    // resolved through the template join. Admins may read order_items via RLS.
    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('id, order_id, status, details, template_id, templates(service_type)')
      .in('order_id', orderIds);

    const itemsMap = new Map<string, OrderItemRow[]>();
    (itemsData || []).forEach((raw: any) => {
      const item: OrderItemRow = {
        id: raw.id,
        order_id: raw.order_id,
        status: raw.status ?? null,
        details: (raw.details || {}) as Record<string, any>,
        template_id: raw.template_id ?? null,
        templates: (raw.templates || null) as OrderItemRow['templates'],
      };
      const list = itemsMap.get(item.order_id) || [];
      list.push(item);
      itemsMap.set(item.order_id, list);
    });
    setOrderItemsByOrder(itemsMap);

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

  const loadRecurring = useCallback(async () => {
    // Table may not exist yet on environments where the migration hasn't run; degrade gracefully.
    const { data, error } = await supabase
      .from('recurring_expenses' as any)
      .select('*')
      .order('created_at', { ascending: false }) as any;
    if (error) { setRecurring([]); return; }
    setRecurring((data as RecurringExpense[]) || []);
  }, []);

  // Real AI generation cost for the selected period (sum of platform cost in IQD
  // across all customers). Same RPC the AI-usage tab uses; p_to=null means "up to now".
  const loadAiCost = useCallback(async () => {
    const start = getDateStart(dateRange);
    const p_from = start ? start.toISOString() : null;
    const { data, error } = await supabase.rpc('ai_usage_by_customer' as never, { p_from, p_to: null } as never);
    if (error || !data) { setAiCost(0); return; }
    const total = (data as any[]).reduce((s, r) => s + Number(r.total_cost_iqd || 0), 0);
    setAiCost(Math.round(total));
  }, [dateRange]);

  useEffect(() => { loadOrders(); loadExpenses(); loadRecurring(); }, [loadOrders, loadExpenses, loadRecurring]);
  useEffect(() => { loadAiCost(); }, [loadAiCost]);

  // Realtime
  useEffect(() => {
    const ch1 = supabase.channel('accounts-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders()).subscribe();
    const ch2 = supabase.channel('accounts-expenses').on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => loadExpenses()).subscribe();
    const ch3 = supabase.channel('accounts-order-items').on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => loadOrders()).subscribe();
    const ch4 = supabase.channel('accounts-recurring').on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_expenses' }, () => loadRecurring()).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); };
  }, [loadOrders, loadExpenses, loadRecurring]);

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

  // Revenue (sales) = sum of per-line revenue for completed orders
  const totalSales = useMemo(() => completedOrders.reduce((s, o) => s + revenueOf(o), 0), [completedOrders, revenueOf]);
  // Production cost (COGS) = sum of per-line cost for completed orders
  const totalProductionCost = useMemo(() => completedOrders.reduce((s, o) => s + costOf(o), 0), [completedOrders, costOf]);
  // One-off operating expenses recorded in the period.
  const manualExpenses = useMemo(() => dateFilteredExpenses.reduce((s, e) => s + e.amount, 0), [dateFilteredExpenses]);

  // Number of calendar months the selected range spans — used to scale the fixed
  // monthly recurring expenses across the period.
  const monthsInRange = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
      case 'week':
      case 'month': return 1;
      case 'quarter': return 3;
      case 'year': return now.getMonth() + 1;
      case 'all': {
        const times: number[] = [];
        orders.forEach(o => times.push(new Date(o.created_at).getTime()));
        expenses.forEach(e => times.push(new Date(e.expense_date).getTime()));
        if (!times.length) return 1;
        const earliest = new Date(Math.min(...times));
        return Math.max(1, (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1);
      }
    }
  }, [dateRange, orders, expenses]);

  // Active fixed monthly commitments and their contribution to the period.
  const recurringMonthly = useMemo(() => recurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0), [recurring]);
  const recurringForPeriod = recurringMonthly * monthsInRange;

  // Total operating expenses for the period = one-off + recurring contribution.
  const totalExpenses = manualExpenses + recurringForPeriod;
  // Gross profit
  const grossProfit = totalSales - totalProductionCost;
  // Net profit — deducts operating expenses (one-off + recurring) and the real AI
  // generation cost. (AI fee revenue is already in totalSales; AI items carry zero
  // COGS, so net profit is the only place the platform's AI spend is subtracted.)
  const netProfit = grossProfit - totalExpenses - aiCost;
  // Gross margin
  const grossMargin = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;
  // Net margin
  const netMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0;

  // ─── Marketing ───
  const marketingMonthlyRecurring = useMemo(
    () => recurring.filter(r => r.active && r.category === MARKETING_CATEGORY).reduce((s, r) => s + r.amount, 0),
    [recurring],
  );
  const marketingSpend = useMemo(() => {
    const oneOff = dateFilteredExpenses.filter(e => e.category === MARKETING_CATEGORY).reduce((s, e) => s + e.amount, 0);
    return oneOff + marketingMonthlyRecurring * monthsInRange;
  }, [dateFilteredExpenses, marketingMonthlyRecurring, monthsInRange]);
  const marketingPctOfSales = totalSales > 0 ? Math.round((marketingSpend / totalSales) * 100) : 0;
  // Sales generated per 1 IQD of marketing spend.
  const marketingRoi = marketingSpend > 0 ? totalSales / marketingSpend : 0;

  // Collection (recognized): cash on COMPLETED orders only.
  const confirmedPaid = useMemo(() => completedOrders.reduce((s, o) => s + o.paid_amount, 0), [completedOrders]);
  const confirmedRemaining = totalSales - confirmedPaid;
  const collectionRate = totalSales > 0 ? Math.round((confirmedPaid / totalSales) * 100) : 0;

  // Cash actually received across ALL active (non-draft, non-cancelled) orders —
  // includes deposits on in-progress orders, so cash-on-hand is visible.
  const totalCashReceived = useMemo(() => activeOrders.reduce((s, o) => s + o.paid_amount, 0), [activeOrders]);

  // Pending value
  const pendingValue = useMemo(() => pendingOrders.reduce((s, o) => s + revenueOf(o), 0), [pendingOrders, revenueOf]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; paid: number }>();
    completedOrders.forEach(o => {
      const key = o.customer_id;
      const prev = map.get(key) || { name: o.customer_name || '-', total: 0, count: 0, paid: 0 };
      prev.total += revenueOf(o);
      prev.paid += o.paid_amount;
      prev.count += 1;
      prev.name = o.customer_name || prev.name;
      map.set(key, prev);
    });
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [completedOrders, revenueOf]);

  // Service breakdown with cost — aggregated per LINE service type, so a
  // multi-item order contributes to each of the services it touches.
  const serviceRevenue = useMemo(() => {
    const map = new Map<string, { key: string; label: string; revenue: number; cost: number; profit: number; count: number; pending: number }>();
    activeOrders.forEach(o => {
      const isCompleted = COMPLETED.includes(o.status);
      linesOf(o).forEach(line => {
        const key = line.serviceType || 'unknown';
        const prev = map.get(key) || { key, label: SERVICE_LABELS[key] || key, revenue: 0, cost: 0, profit: 0, count: 0, pending: 0 };
        if (isCompleted) {
          prev.revenue += line.revenue;
          prev.cost += line.cost;
          prev.profit += (line.revenue - line.cost);
        } else {
          prev.pending += line.revenue;
        }
        prev.count += 1;
        map.set(key, prev);
      });
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [activeOrders, SERVICE_LABELS, linesOf]);

  // Expense by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    dateFilteredExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    // Fold in the recurring contribution for the period so the breakdown matches totals.
    recurring.filter(r => r.active).forEach(r => {
      map.set(r.category, (map.get(r.category) || 0) + r.amount * monthsInRange);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [dateFilteredExpenses, recurring, monthsInRange]);

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
      const rev = monthOrders.reduce((s, o) => s + revenueOf(o), 0);
      const cst = monthOrders.reduce((s, o) => s + costOf(o), 0);
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
  }, [orders, expenses, revenueOf, costOf]);

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
  if (sortBy === 'highest') filtered = [...filtered].sort((a, b) => revenueOf(b) - revenueOf(a));
  if (sortBy === 'lowest') filtered = [...filtered].sort((a, b) => revenueOf(a) - revenueOf(b));
  if (sortBy === 'unpaid_first') filtered = [...filtered].sort((a, b) => {
    const order = { unpaid: 0, partial: 1, paid: 2 };
    return (order[a.payment_status as keyof typeof order] ?? 3) - (order[b.payment_status as keyof typeof order] ?? 3);
  });

  // ─── Actions ───
  const handleUpdatePayment = async (orderId: string, amount: number, orderTotal: number) => {
    // Clamp: never store more than the order total (still allows exact full payment).
    const paidAmount = orderTotal > 0 ? Math.min(Math.max(0, amount), orderTotal) : Math.max(0, amount);
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

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setDeletingExpense(true);
    const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete.id);
    setDeletingExpense(false);
    if (error) { toast.error('فشل الحذف'); return; }
    toast.success('تم الحذف');
    setExpenseToDelete(null);
    loadExpenses();
  };

  // ─── Recurring expense CRUD ───
  const openAddRecurring = () => {
    setEditingRecurring(null);
    setRecurringForm({ title: '', amount: 0, category: 'إيجار', notes: '', active: true });
    setRecurringDialogOpen(true);
  };

  const openEditRecurring = (r: RecurringExpense) => {
    setEditingRecurring(r);
    setRecurringForm({ title: r.title, amount: r.amount, category: r.category, notes: r.notes || '', active: r.active });
    setRecurringDialogOpen(true);
  };

  const handleSaveRecurring = async () => {
    if (!recurringForm.title.trim()) { toast.error('عنوان المصروف مطلوب'); return; }
    if (recurringForm.amount <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
    setSavingRecurring(true);
    try {
      if (editingRecurring) {
        const { error } = await supabase.from('recurring_expenses' as any).update({
          title: recurringForm.title,
          amount: recurringForm.amount,
          category: recurringForm.category,
          notes: recurringForm.notes || null,
          active: recurringForm.active,
        } as any).eq('id', editingRecurring.id);
        if (error) throw error;
        toast.success('تم تحديث المصروف الشهري');
      } else {
        const { error } = await supabase.from('recurring_expenses' as any).insert({
          title: recurringForm.title,
          amount: recurringForm.amount,
          category: recurringForm.category,
          notes: recurringForm.notes || null,
          active: recurringForm.active,
          created_by: user?.id,
        } as any);
        if (error) throw error;
        toast.success('تمت إضافة المصروف الشهري');
      }
      setRecurringDialogOpen(false);
      loadRecurring();
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    } finally {
      setSavingRecurring(false);
    }
  };

  const toggleRecurringActive = async (r: RecurringExpense) => {
    const { error } = await supabase.from('recurring_expenses' as any).update({ active: !r.active } as any).eq('id', r.id);
    if (error) { toast.error('فشل التحديث'); return; }
    loadRecurring();
  };

  const confirmDeleteRecurring = async () => {
    if (!recurringToDelete) return;
    setDeletingRecurring(true);
    const { error } = await supabase.from('recurring_expenses' as any).delete().eq('id', recurringToDelete.id);
    setDeletingRecurring(false);
    if (error) { toast.error('فشل الحذف'); return; }
    toast.success('تم الحذف');
    setRecurringToDelete(null);
    loadRecurring();
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    const rows = filtered.map((o, i) => {
      const revenue = revenueOf(o);
      const cost = costOf(o);
      const types = serviceTypesOf(o);
      const serviceLabel = types.length > 1
        ? 'متعدد'
        : (SERVICE_LABELS[types[0] || o.templates?.service_type || ''] || '-');
      return {
        '#': i + 1,
        'رقم الطلب': o.id.slice(0, 8).toUpperCase(),
        'الزبون': o.customer_name || '-',
        'الهاتف': o.customer_phone || '-',
        'الخدمة': serviceLabel,
        'القالب': o.templates?.name || '-',
        'الكمية': quantityOf(o),
        'المبيعات': revenue,
        'التكلفة': cost,
        'الربح': revenue - cost,
        'المدفوع': o.paid_amount,
        'حالة الدفع': PAYMENT_LABELS[o.payment_status] || o.payment_status,
        'حالة الطلب': STATUS_LABELS[o.status as OrderStatus] || o.status,
        'التاريخ': new Date(o.created_at).toLocaleDateString('ar-IQ'),
      };
    });
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
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
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
            sub: recurringForPeriod > 0 ? `${fmt(recurringForPeriod)} متكرر + ${fmt(manualExpenses)} متفرق` : `${dateFilteredExpenses.length} مصروف`,
            icon: Minus,
            iconBg: 'bg-destructive/10',
            iconColor: 'text-destructive',
            valueColor: 'text-destructive',
          },
          {
            label: 'تكلفة الذكاء الاصطناعي',
            value: fmt(aiCost),
            sub: 'تكلفة التوليد الفعلية',
            icon: Sparkles,
            iconBg: 'bg-amber-500/10',
            iconColor: 'text-amber-600',
            valueColor: 'text-amber-600',
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
          { label: 'المبالغ المستلمة', value: fmt(confirmedPaid), sub: `نقد مستلم (شامل العرابين): ${fmt(totalCashReceived)} د.ع`, icon: Wallet, iconBg: 'bg-success/10', iconColor: 'text-success', valueColor: 'text-success' },
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
                        const orderTotal = revenueOf(order);
                        const orderCost = costOf(order);
                        const orderProfit = orderTotal - orderCost;
                        const remaining = orderTotal - order.paid_amount;
                        const isEditing = editingPayment === order.id;
                        const qty = quantityOf(order);
                        const svcTypes = serviceTypesOf(order);
                        const svcLabel = svcTypes.length > 1
                          ? 'متعدد'
                          : (SERVICE_LABELS[svcTypes[0] || order.templates?.service_type || ''] || '');

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
                              <p className="text-[10px] text-muted-foreground">{svcLabel}</p>
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
            {/* Operating-expenses clarification */}
            <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-[11px] text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
              <span>تُحتسب تكلفة الإنتاج تلقائياً لكل طلب. المصروفات هنا هي مصاريف تشغيلية فقط (إيجار، رواتب، تسويق…).</span>
            </div>

            {/* ═══ Marketing ═══ */}
            <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-primary" /> التسويق
                </h4>
                <span className="text-[11px] text-muted-foreground">فئة «{MARKETING_CATEGORY}»</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">إنفاق التسويق</p>
                  <p className="text-lg font-bold text-foreground leading-none">{fmt(marketingSpend)} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">نسبة من المبيعات</p>
                  <p className="text-lg font-bold text-foreground leading-none">{marketingPctOfSales}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">العائد (مبيعات لكل 1 د.ع)</p>
                  <p className={`text-lg font-bold leading-none ${marketingRoi >= 1 ? 'text-success' : 'text-destructive'}`}>
                    {marketingRoi > 0 ? `${marketingRoi.toFixed(1)}×` : '—'}
                  </p>
                </div>
              </div>
              {marketingMonthlyRecurring > 0 && (
                <p className="text-[10px] text-muted-foreground mt-3 pt-3 border-t border-border/50">
                  يشمل {fmt(marketingMonthlyRecurring)} د.ع تسويق شهري متكرر × {monthsInRange} شهر
                </p>
              )}
            </div>

            {/* ═══ Monthly recurring expenses ═══ */}
            <div>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-primary" /> المصروفات الشهرية المتكررة
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    التزامات ثابتة تُحتسب تلقائياً كل شهر — {fmt(recurringMonthly)} د.ع/شهر
                    {recurringForPeriod !== recurringMonthly && <> (≈ {fmt(recurringForPeriod)} د.ع لهذه الفترة × {monthsInRange} شهر)</>}
                  </p>
                </div>
                <Button onClick={openAddRecurring} size="sm" variant="outline" className="rounded-xl gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> إضافة مصروف شهري
                </Button>
              </div>
              {recurring.length === 0 ? (
                <div className="text-center py-8 bg-card/80 rounded-2xl border border-border/50 text-muted-foreground text-sm">
                  لا توجد مصروفات شهرية متكررة
                </div>
              ) : (
                <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-right text-[11px] font-semibold">العنوان</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold w-[100px]">الفئة</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold w-[110px]">المبلغ/شهر</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold w-[80px]">الحالة</TableHead>
                          <TableHead className="text-right text-[11px] font-semibold w-[80px]">إجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recurring.map(r => (
                          <TableRow key={r.id} className={`group ${!r.active ? 'opacity-50' : ''}`}>
                            <TableCell>
                              <p className="text-xs font-medium text-foreground">{r.title}</p>
                              {r.notes && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{r.notes}</p>}
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{r.category}</Badge></TableCell>
                            <TableCell><span className="text-xs font-bold text-destructive">{fmt(r.amount)} د.ع</span></TableCell>
                            <TableCell>
                              <button
                                onClick={() => toggleRecurringActive(r)}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${r.active ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'}`}
                              >
                                {r.active ? 'نشط' : 'متوقف'}
                              </button>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditRecurring(r)}><Pencil className="w-3 h-3" /></Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setRecurringToDelete(r)}><Trash2 className="w-3 h-3" /></Button>
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
              <h3 className="text-sm font-bold text-foreground">مصروفات لمرة واحدة</h3>
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
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setExpenseToDelete(exp)}>
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

      {/* ═══ Delete Expense Confirmation ═══ */}
      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => { if (!open && !deletingExpense) setExpenseToDelete(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المصروف "{expenseToDelete?.title ?? ''}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deletingExpense} className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteExpense(); }}
              disabled={deletingExpense}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingExpense ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Recurring Expense Dialog ═══ */}
      <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingRecurring ? 'تعديل مصروف شهري' : 'إضافة مصروف شهري متكرر'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">العنوان *</label>
              <Input
                value={recurringForm.title}
                onChange={e => setRecurringForm(f => ({ ...f, title: e.target.value }))}
                placeholder="مثال: إيجار المحل، راتب موظف..."
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">المبلغ شهرياً (د.ع) *</label>
                <Input
                  type="number"
                  value={recurringForm.amount || ''}
                  onChange={e => setRecurringForm(f => ({ ...f, amount: parseInt(e.target.value) || 0 }))}
                  placeholder="500000"
                  className="rounded-xl"
                  dir="ltr"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">الفئة</label>
                <Select value={recurringForm.category} onValueChange={v => setRecurringForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">ملاحظات</label>
              <Textarea
                value={recurringForm.notes}
                onChange={e => setRecurringForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات إضافية..."
                className="rounded-xl min-h-[60px]"
              />
            </div>
            <label className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3 cursor-pointer">
              <span className="text-sm font-medium text-foreground">نشط (يُحتسب شهرياً)</span>
              <input
                type="checkbox"
                checked={recurringForm.active}
                onChange={e => setRecurringForm(f => ({ ...f, active: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveRecurring} disabled={savingRecurring} className="flex-1 rounded-xl">
                {savingRecurring ? 'جاري الحفظ...' : editingRecurring ? 'حفظ التغييرات' : 'إضافة'}
              </Button>
              <Button variant="outline" onClick={() => setRecurringDialogOpen(false)} disabled={savingRecurring} className="rounded-xl">
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Recurring Confirmation ═══ */}
      <AlertDialog open={!!recurringToDelete} onOpenChange={(open) => { if (!open && !deletingRecurring) setRecurringToDelete(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المصروف الشهري "{recurringToDelete?.title ?? ''}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deletingRecurring} className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteRecurring(); }}
              disabled={deletingRecurring}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRecurring ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAccounts;
