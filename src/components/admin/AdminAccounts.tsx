import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, STATUS_LABELS, ServiceType, OrderStatus } from '@/data/mockData';
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
  Receipt, Calendar, CreditCard, X
} from 'lucide-react';

interface OrderWithTemplate {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  paid_amount: number;
  payment_status: string;
  created_at: string;
  templates: {
    name: string;
    service_type: string;
    price: number | null;
  } | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'غير مدفوع',
  partial: 'جزئي',
  paid: 'مدفوع',
};

const PAYMENT_ICONS: Record<string, typeof AlertCircle> = {
  unpaid: AlertCircle,
  partial: Clock,
  paid: CheckCircle,
};

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
  partial: 'bg-accent/15 text-accent-foreground border-accent/30',
  paid: 'bg-success/10 text-success border-success/20',
};

const AdminAccounts = () => {
  const [orders, setOrders] = useState<OrderWithTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, status, paid_amount, payment_status, created_at, templates(name, service_type, price)')
      .order('created_at', { ascending: false });
    setOrders((data as unknown as OrderWithTemplate[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleUpdatePayment = async (orderId: string, amount: number, templatePrice: number) => {
    const paidAmount = Math.max(0, amount);
    let paymentStatus = 'unpaid';
    if (paidAmount >= templatePrice && templatePrice > 0) paymentStatus = 'paid';
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

  const handleMarkPaid = async (orderId: string, templatePrice: number) => {
    await handleUpdatePayment(orderId, templatePrice, templatePrice);
  };

  // Filtering
  let filtered = orders;
  if (paymentFilter !== 'all') filtered = filtered.filter(o => o.payment_status === paymentFilter);
  if (serviceFilter !== 'all') filtered = filtered.filter(o => o.templates?.service_type === serviceFilter);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(o =>
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  }
  if (sortBy === 'oldest') filtered = [...filtered].reverse();
  if (sortBy === 'highest') filtered = [...filtered].sort((a, b) => (b.templates?.price || 0) - (a.templates?.price || 0));
  if (sortBy === 'lowest') filtered = [...filtered].sort((a, b) => (a.templates?.price || 0) - (b.templates?.price || 0));

  // Stats
  const totalRevenue = orders.reduce((sum, o) => sum + (o.templates?.price || 0), 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.paid_amount, 0);
  const totalRemaining = totalRevenue - totalPaid;
  const paidCount = orders.filter(o => o.payment_status === 'paid').length;
  const unpaidCount = orders.filter(o => o.payment_status === 'unpaid').length;
  const partialCount = orders.filter(o => o.payment_status === 'partial').length;

  const now = new Date();
  const currentMonthOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyRevenue = currentMonthOrders.reduce((sum, o) => sum + (o.templates?.price || 0), 0);
  const monthlyPaid = currentMonthOrders.reduce((sum, o) => sum + o.paid_amount, 0);

  const serviceRevenue = Object.keys(SERVICE_LABELS).map(key => {
    const serviceOrders = orders.filter(o => o.templates?.service_type === key);
    return {
      key,
      label: SERVICE_LABELS[key as ServiceType],
      total: serviceOrders.reduce((s, o) => s + (o.templates?.price || 0), 0),
      paid: serviceOrders.reduce((s, o) => s + o.paid_amount, 0),
      count: serviceOrders.length,
    };
  }).filter(s => s.count > 0).sort((a, b) => b.total - a.total);

  const fmt = (n: number) => n.toLocaleString('en-US');
  const collectionRate = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0;

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الإيرادات', value: fmt(totalRevenue), sub: `${orders.length} طلب`, icon: DollarSign, iconBg: 'bg-primary/10', iconColor: 'text-primary', valueColor: 'text-foreground' },
          { label: 'المبالغ المستلمة', value: fmt(totalPaid), sub: `${collectionRate}% نسبة التحصيل`, icon: TrendingUp, iconBg: 'bg-success/10', iconColor: 'text-success', valueColor: 'text-success' },
          { label: 'المبالغ المتبقية', value: fmt(totalRemaining), sub: `${unpaidCount + partialCount} طلب معلق`, icon: TrendingDown, iconBg: 'bg-destructive/10', iconColor: 'text-destructive', valueColor: 'text-destructive' },
          { label: 'إيرادات الشهر', value: fmt(monthlyRevenue), sub: `مستلم: ${fmt(monthlyPaid)} د.ع`, icon: Calendar, iconBg: 'bg-primary/10', iconColor: 'text-primary', valueColor: 'text-foreground' },
        ].map((stat, i) => (
          <Card key={i} className="border-border overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] font-medium text-muted-foreground leading-tight">{stat.label}</span>
                <div className={`w-8 h-8 rounded-lg ${stat.iconBg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
              </div>
              <p className={`text-xl font-bold ${stat.valueColor} leading-none`}>{stat.value} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span></p>
              <p className="text-[10px] text-muted-foreground mt-1.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Status Chips + Service Breakdown side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Payment Status - 2 cols */}
        <div className="lg:col-span-2 space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">حالة الدفع</h4>
          {[
            { key: 'paid', label: 'مدفوع بالكامل', count: paidCount, color: 'border-success/30 bg-success/5', dotColor: 'bg-success' },
            { key: 'partial', label: 'مدفوع جزئياً', count: partialCount, color: 'border-accent/30 bg-accent/5', dotColor: 'bg-accent' },
            { key: 'unpaid', label: 'غير مدفوع', count: unpaidCount, color: 'border-destructive/30 bg-destructive/5', dotColor: 'bg-destructive' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setPaymentFilter(paymentFilter === s.key ? 'all' : s.key)}
              className={`w-full flex items-center justify-between rounded-lg border p-3 transition-all ${
                paymentFilter === s.key ? s.color + ' ring-1 ring-ring' : 'border-border bg-card hover:bg-muted/50'
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

        {/* Service Revenue - 3 cols */}
        <div className="lg:col-span-3">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" />
            الإيرادات حسب الخدمة
          </h4>
          {serviceRevenue.length > 0 ? (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {serviceRevenue.map(s => {
                const pct = s.total > 0 ? (s.paid / s.total) * 100 : 0;
                return (
                  <div key={s.key} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm text-foreground w-28 shrink-0 font-medium">{s.label}</span>
                    <div className="flex-1">
                      <div className="bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-success h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-left shrink-0 w-36">
                      <span className="text-xs font-bold text-success">{fmt(s.paid)}</span>
                      <span className="text-xs text-muted-foreground"> / {fmt(s.total)}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{s.count}</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">لا توجد بيانات</div>
          )}
        </div>
      </div>

      {/* Orders Table Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            تفاصيل المدفوعات
          </h3>
          <span className="text-xs text-muted-foreground">{filtered.length} من {orders.length}</span>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث..."
              className="pr-9 h-9 text-xs rounded-lg"
            />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs rounded-lg">
              <SelectValue placeholder="الخدمة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الخدمات</SelectItem>
              {Object.entries(SERVICE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px] h-9 text-xs rounded-lg">
              <SelectValue placeholder="ترتيب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث</SelectItem>
              <SelectItem value="oldest">الأقدم</SelectItem>
              <SelectItem value="highest">الأعلى سعراً</SelectItem>
              <SelectItem value="lowest">الأقل سعراً</SelectItem>
            </SelectContent>
          </Select>
          {(paymentFilter !== 'all' || searchQuery || serviceFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setPaymentFilter('all'); setSearchQuery(''); setServiceFilter('all'); }}>
              <X className="w-3 h-3 ml-1" /> مسح الفلاتر
            </Button>
          )}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border">
            <DollarSign className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد طلبات مطابقة</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-right text-[11px] font-semibold w-[180px]">الزبون</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold">القالب</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[80px]">الحالة</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[90px]">السعر</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[90px]">المدفوع</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[80px]">الدفع</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[120px]">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order, i) => {
                    const price = order.templates?.price || 0;
                    const remaining = price - order.paid_amount;
                    const isEditing = editingPayment === order.id;
                    const PayIcon = PAYMENT_ICONS[order.payment_status] || AlertCircle;

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
                          <p className="text-[10px] text-muted-foreground">{SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] text-muted-foreground">{STATUS_LABELS[order.status as OrderStatus] || order.status}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-bold text-foreground">{price > 0 ? fmt(price) : '-'}</span>
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
                            <PayIcon className="w-2.5 h-2.5" />
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
                              <Button size="sm" className="h-7 text-[10px] px-2 rounded" onClick={() => handleUpdatePayment(order.id, parseInt(editAmount) || 0, price)}>
                                ✓
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1.5 rounded" onClick={() => setEditingPayment(null)}>
                                ✗
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                              {order.payment_status !== 'paid' && price > 0 && (
                                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded" onClick={() => handleMarkPaid(order.id, price)}>
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
