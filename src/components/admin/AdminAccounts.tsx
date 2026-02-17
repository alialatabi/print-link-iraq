import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { SERVICE_LABELS, STATUS_LABELS, ServiceType, OrderStatus } from '@/data/mockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard,
  Search, Calendar, CheckCircle, Clock, AlertCircle,
  ArrowUpDown, Receipt
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
  partial: 'مدفوع جزئياً',
  paid: 'مدفوع بالكامل',
};

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: 'bg-destructive/10 text-destructive',
  partial: 'bg-cmyk-yellow/15 text-cmyk-yellow',
  paid: 'bg-success/10 text-success',
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

  // Financial Stats
  const totalRevenue = orders.reduce((sum, o) => sum + (o.templates?.price || 0), 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.paid_amount, 0);
  const totalRemaining = totalRevenue - totalPaid;
  const paidCount = orders.filter(o => o.payment_status === 'paid').length;
  const unpaidCount = orders.filter(o => o.payment_status === 'unpaid').length;
  const partialCount = orders.filter(o => o.payment_status === 'partial').length;

  // Monthly revenue (current month)
  const now = new Date();
  const currentMonthOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyRevenue = currentMonthOrders.reduce((sum, o) => sum + (o.templates?.price || 0), 0);
  const monthlyPaid = currentMonthOrders.reduce((sum, o) => sum + o.paid_amount, 0);

  // Per-service revenue
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

  const fmt = (n: number) => n.toLocaleString('ar-IQ');

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{fmt(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">د.ع</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <span className="text-xs text-muted-foreground">المبالغ المستلمة</span>
            </div>
            <p className="text-2xl font-bold text-success">{fmt(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">د.ع</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <span className="text-xs text-muted-foreground">المبالغ المتبقية</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{fmt(totalRemaining)}</p>
            <p className="text-xs text-muted-foreground">د.ع</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-cmyk-cyan/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cmyk-cyan" />
              </div>
              <span className="text-xs text-muted-foreground">إيرادات الشهر</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{fmt(monthlyRevenue)}</p>
            <p className="text-xs text-muted-foreground">مستلم: {fmt(monthlyPaid)} د.ع</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Status Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="w-4 h-4 text-success" />
          </div>
          <p className="text-xl font-bold text-foreground">{paidCount}</p>
          <p className="text-xs text-muted-foreground">مدفوع بالكامل</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <div className="w-8 h-8 rounded-lg bg-cmyk-yellow/10 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-4 h-4 text-cmyk-yellow" />
          </div>
          <p className="text-xl font-bold text-foreground">{partialCount}</p>
          <p className="text-xs text-muted-foreground">مدفوع جزئياً</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border text-center">
          <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-xl font-bold text-foreground">{unpaidCount}</p>
          <p className="text-xs text-muted-foreground">غير مدفوع</p>
        </div>
      </div>

      {/* Revenue by Service */}
      {serviceRevenue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              الإيرادات حسب الخدمة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serviceRevenue.map(s => {
                const pct = s.total > 0 ? (s.paid / s.total) * 100 : 0;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-24 shrink-0">{s.label}</span>
                    <div className="flex-1">
                      <div className="bg-muted rounded-full h-3 overflow-hidden">
                        <div className="bg-success h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-left shrink-0 w-40 text-xs">
                      <span className="text-success font-bold">{fmt(s.paid)}</span>
                      <span className="text-muted-foreground"> / {fmt(s.total)} د.ع</span>
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-left">{s.count} طلب</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders Payment List */}
      <div>
        <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          تفاصيل المدفوعات
        </h3>

        {/* Filters */}
        <div className="bg-card rounded-xl p-4 border border-border mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو الهاتف..."
                className="pr-9 rounded-lg"
              />
            </div>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="حالة الدفع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="unpaid">غير مدفوع ({unpaidCount})</SelectItem>
                <SelectItem value="partial">مدفوع جزئياً ({partialCount})</SelectItem>
                <SelectItem value="paid">مدفوع بالكامل ({paidCount})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="rounded-lg">
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
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="ترتيب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">الأحدث أولاً</SelectItem>
                <SelectItem value="oldest">الأقدم أولاً</SelectItem>
                <SelectItem value="highest">الأعلى سعراً</SelectItem>
                <SelectItem value="lowest">الأقل سعراً</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground mt-2">عرض {filtered.length} من {orders.length} طلب</p>
        </div>

        {/* Orders List */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <DollarSign className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">لا توجد طلبات مطابقة</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((order, i) => {
              const price = order.templates?.price || 0;
              const remaining = price - order.paid_amount;
              const isEditing = editingPayment === order.id;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className="bg-card rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-foreground text-sm">{order.customer_name || '-'}</h4>
                        <span className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8)}</span>
                        <Badge className={`text-[10px] px-2 py-0 ${PAYMENT_COLORS[order.payment_status]}`}>
                          {PAYMENT_LABELS[order.payment_status]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{order.templates?.name || '-'}</span>
                        <span>{SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}</span>
                        <span>{STATUS_LABELS[order.status as OrderStatus] || order.status}</span>
                        <span>{new Date(order.created_at).toLocaleDateString('ar')}</span>
                      </div>
                    </div>

                    {/* Price & Payment */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground">{fmt(price)} <span className="text-xs font-normal text-muted-foreground">د.ع</span></p>
                        {order.paid_amount > 0 && order.payment_status !== 'paid' && (
                          <p className="text-xs text-success">مدفوع: {fmt(order.paid_amount)}</p>
                        )}
                        {remaining > 0 && order.payment_status !== 'paid' && (
                          <p className="text-xs text-destructive">متبقي: {fmt(remaining)}</p>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            className="w-28 h-8 text-xs rounded-lg"
                            placeholder="المبلغ"
                            min="0"
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs rounded-lg"
                            onClick={() => handleUpdatePayment(order.id, parseInt(editAmount) || 0, price)}
                          >
                            حفظ
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs rounded-lg"
                            onClick={() => setEditingPayment(null)}
                          >
                            إلغاء
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {order.payment_status !== 'paid' && price > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs rounded-lg"
                              onClick={() => handleMarkPaid(order.id, price)}
                            >
                              <CheckCircle className="w-3 h-3 ml-1" />
                              تم الدفع
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs rounded-lg"
                            onClick={() => {
                              setEditingPayment(order.id);
                              setEditAmount(order.paid_amount.toString());
                            }}
                          >
                            <CreditCard className="w-3 h-3 ml-1" />
                            تعديل
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAccounts;
