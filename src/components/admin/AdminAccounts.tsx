import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_LABELS, type OrderStatus } from '@/data/mockData';
import { useServices, buildLabelMap } from '@/hooks/useServices';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { buildCatalog, computeLine, type PricingSnapshot } from '@/lib/orderPricing';
import { PAYMENT_LABELS, DATE_RANGE_LABELS } from '@/lib/constants';
import type { DateRange } from '@/lib/constants';
import { handleSupabaseError } from '@/lib/errors';
import type { OrderDetailsJson } from '@/types/db';
import { CalendarDays, Receipt, Minus } from 'lucide-react';
import type {
  OrderRow, OrderItemRow, Expense, RecurringExpense,
  ExpenseForm, RecurringForm,
} from './accounts/types';
import { AccountsPLSummary } from './accounts/AccountsPLSummary';
import { AccountsOrdersTab } from './accounts/AccountsOrdersTab';
import { AccountsExpensesTab } from './accounts/AccountsExpensesTab';
import { ExpenseDialogs } from './accounts/ExpenseDialogs';
import { RecurringExpenseDialogs } from './accounts/RecurringExpenseDialogs';

// ─── Constants ───

// NOTE: 'مواد خام' (raw materials / production cost) is intentionally NOT suggested here.
// Production cost is now counted automatically per order via per-line cost snapshots.
// Expenses recorded here are OPERATING expenses only (rent, salaries, marketing…).

// The category that counts as marketing spend (drives the marketing section).
const MARKETING_CATEGORY = 'تسويق';

// ─── Helpers ───
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
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({ title: '', amount: 0, category: 'عام', notes: '', expense_date: new Date().toISOString().slice(0, 10) });
  const [savingExpense, setSavingExpense] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // Recurring (fixed monthly) expenses
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [recurringForm, setRecurringForm] = useState<RecurringForm>({ title: '', amount: 0, category: 'إيجار', notes: '', active: true });
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

  // Variant label(s) + gift touched by an order, read straight off each line's stored pricing
  // snapshot (no catalog lookup needed). Empty for legacy/non-variant orders — purely additive
  // display info for the accounting table (see AccountsOrdersTab).
  const variantInfoOf = useCallback((order: OrderRow): { label: string; gift?: number }[] => {
    const items = orderItemsByOrder.get(order.id);
    const detailsList: OrderDetailsJson[] = items && items.length > 0
      ? items.map(it => it.details)
      : [order.details];
    return detailsList
      .map(d => d?.pricing as PricingSnapshot | undefined)
      .filter((p): p is PricingSnapshot => Boolean(p?.variant_label))
      .map(p => ({ label: p.variant_label as string, gift: p.gift_quantity }));
  }, [orderItemsByOrder]);

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
    (itemsData || []).forEach((raw) => {
      const item: OrderItemRow = {
        id: raw.id,
        order_id: raw.order_id,
        status: raw.status ?? null,
        details: (raw.details || {}) as OrderDetailsJson,
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
        details: (o.details || {}) as OrderDetailsJson,
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
      .order('expense_date', { ascending: false });
    setExpenses((data as Expense[]) || []);
  }, []);

  const loadRecurring = useCallback(async () => {
    // Table may not exist yet on environments where the migration hasn't run; degrade gracefully.
    const { data, error } = await supabase
      .from('recurring_expenses' as never)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { setRecurring([]); return; }
    setRecurring((data as unknown as RecurringExpense[]) || []);
  }, []);

  // Real AI generation cost for the selected period (sum of platform cost in IQD
  // across all customers). Same RPC the AI-usage tab uses; p_to=null means "up to now".
  const loadAiCost = useCallback(async () => {
    const start = getDateStart(dateRange);
    const p_from = start ? start.toISOString() : null;
    const { data, error } = await supabase.rpc('ai_usage_by_customer' as never, { p_from, p_to: null } as never);
    if (error || !data) { setAiCost(0); return; }
    const total = (data as { total_cost_iqd?: number | string }[]).reduce((s, r) => s + Number(r.total_cost_iqd || 0), 0);
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
      .update({ paid_amount: paidAmount, payment_status: paymentStatus })
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
        }).eq('id', editingExpense.id);
        if (error) throw error;
        toast.success('تم تحديث المصروف');
      } else {
        const { error } = await supabase.from('expenses').insert({
          title: expenseForm.title,
          amount: expenseForm.amount,
          category: expenseForm.category,
          notes: expenseForm.notes || null,
          expense_date: expenseForm.expense_date,
          created_by: user!.id,
        });
        if (error) throw error;
        toast.success('تمت إضافة المصروف');
      }
      setExpenseDialogOpen(false);
      loadExpenses();
    } catch (e: unknown) {
      toast.error(handleSupabaseError(e));
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
        const { error } = await supabase.from('recurring_expenses' as never).update({
          title: recurringForm.title,
          amount: recurringForm.amount,
          category: recurringForm.category,
          notes: recurringForm.notes || null,
          active: recurringForm.active,
        } as never).eq('id', editingRecurring.id);
        if (error) throw error;
        toast.success('تم تحديث المصروف الشهري');
      } else {
        const { error } = await supabase.from('recurring_expenses' as never).insert({
          title: recurringForm.title,
          amount: recurringForm.amount,
          category: recurringForm.category,
          notes: recurringForm.notes || null,
          active: recurringForm.active,
          created_by: user!.id,
        } as never);
        if (error) throw error;
        toast.success('تمت إضافة المصروف الشهري');
      }
      setRecurringDialogOpen(false);
      loadRecurring();
    } catch (e: unknown) {
      toast.error(handleSupabaseError(e));
    } finally {
      setSavingRecurring(false);
    }
  };

  const toggleRecurringActive = async (r: RecurringExpense) => {
    const { error } = await supabase.from('recurring_expenses' as never).update({ active: !r.active } as never).eq('id', r.id);
    if (error) { toast.error('فشل التحديث'); return; }
    loadRecurring();
  };

  const confirmDeleteRecurring = async () => {
    if (!recurringToDelete) return;
    setDeletingRecurring(true);
    const { error } = await supabase.from('recurring_expenses' as never).delete().eq('id', recurringToDelete.id);
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
      ...rows.map(r => headers.map(h => `"${String((r as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
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

      {/* ═══ P&L Summary (KPI cards + trend + collection) ═══ */}
      <AccountsPLSummary
        totalSales={totalSales}
        completedOrdersCount={completedOrders.length}
        totalProductionCost={totalProductionCost}
        grossProfit={grossProfit}
        grossMargin={grossMargin}
        totalExpenses={totalExpenses}
        recurringForPeriod={recurringForPeriod}
        manualExpenses={manualExpenses}
        dateFilteredExpensesCount={dateFilteredExpenses.length}
        aiCost={aiCost}
        netProfit={netProfit}
        netMargin={netMargin}
        confirmedPaid={confirmedPaid}
        totalCashReceived={totalCashReceived}
        pendingValue={pendingValue}
        pendingOrdersCount={pendingOrders.length}
        collectionRate={collectionRate}
        confirmedRemaining={confirmedRemaining}
        monthlyTrend={monthlyTrend}
        maxMonthRevenue={maxMonthRevenue}
        monthGrowth={monthGrowth}
      />

      {/* ═══ Tabs: الطلبات / المصروفات ═══ */}
      <Tabs defaultValue="orders" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 mb-4 h-auto sm:h-10">
          <TabsTrigger value="orders" className="flex items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs whitespace-normal sm:whitespace-nowrap text-center leading-tight px-1 py-2 sm:px-3 sm:py-1.5">
            <Receipt className="w-3.5 h-3.5 shrink-0" />
            الطلبات والمدفوعات
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center justify-center gap-1 sm:gap-2 text-[10px] sm:text-xs whitespace-normal sm:whitespace-nowrap text-center leading-tight px-1 py-2 sm:px-3 sm:py-1.5">
            <Minus className="w-3.5 h-3.5 shrink-0" />
            المصروفات ({dateFilteredExpenses.length})
          </TabsTrigger>
        </TabsList>

        <AccountsOrdersTab
          filtered={filtered}
          services={services}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          serviceFilter={serviceFilter}
          setServiceFilter={setServiceFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          paidCount={paidCount}
          unpaidCount={unpaidCount}
          partialCount={partialCount}
          serviceRevenue={serviceRevenue}
          topCustomers={topCustomers}
          editingPayment={editingPayment}
          setEditingPayment={setEditingPayment}
          editAmount={editAmount}
          setEditAmount={setEditAmount}
          revenueOf={revenueOf}
          costOf={costOf}
          quantityOf={quantityOf}
          serviceTypesOf={serviceTypesOf}
          variantInfoOf={variantInfoOf}
          SERVICE_LABELS={SERVICE_LABELS}
          onUpdatePayment={handleUpdatePayment}
          onMarkPaid={handleMarkPaid}
          onExportCSV={handleExportCSV}
        />

        <AccountsExpensesTab
          dateFilteredExpenses={dateFilteredExpenses}
          marketingSpend={marketingSpend}
          marketingPctOfSales={marketingPctOfSales}
          marketingRoi={marketingRoi}
          marketingMonthlyRecurring={marketingMonthlyRecurring}
          monthsInRange={monthsInRange}
          recurring={recurring}
          recurringMonthly={recurringMonthly}
          recurringForPeriod={recurringForPeriod}
          expenseByCategory={expenseByCategory}
          totalExpenses={totalExpenses}
          onAddRecurring={openAddRecurring}
          onEditRecurring={openEditRecurring}
          onToggleRecurringActive={toggleRecurringActive}
          onDeleteRecurring={setRecurringToDelete}
          onAddExpense={openAddExpense}
          onEditExpense={openEditExpense}
          onDeleteExpense={setExpenseToDelete}
        />
      </Tabs>

      {/* ═══ Dialogs ═══ */}
      <ExpenseDialogs
        expenseDialogOpen={expenseDialogOpen}
        setExpenseDialogOpen={setExpenseDialogOpen}
        editingExpense={editingExpense}
        expenseForm={expenseForm}
        setExpenseForm={setExpenseForm}
        savingExpense={savingExpense}
        handleSaveExpense={handleSaveExpense}
        expenseToDelete={expenseToDelete}
        setExpenseToDelete={setExpenseToDelete}
        deletingExpense={deletingExpense}
        confirmDeleteExpense={confirmDeleteExpense}
      />

      <RecurringExpenseDialogs
        recurringDialogOpen={recurringDialogOpen}
        setRecurringDialogOpen={setRecurringDialogOpen}
        editingRecurring={editingRecurring}
        recurringForm={recurringForm}
        setRecurringForm={setRecurringForm}
        savingRecurring={savingRecurring}
        handleSaveRecurring={handleSaveRecurring}
        recurringToDelete={recurringToDelete}
        setRecurringToDelete={setRecurringToDelete}
        deletingRecurring={deletingRecurring}
        confirmDeleteRecurring={confirmDeleteRecurring}
      />
    </div>
  );
};

export default AdminAccounts;
