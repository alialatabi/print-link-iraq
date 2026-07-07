import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Receipt, Users, CreditCard, Banknote, DollarSign,
  CheckCircle, X, Download, Search,
} from 'lucide-react';
import { STATUS_LABELS } from '@/data/mockData';
import { PAYMENT_LABELS, PAYMENT_COLORS } from '@/lib/constants';
import type { DbService } from '@/hooks/useServices';
import type { OrderRow, ServiceRevenueEntry, TopCustomerEntry } from './types';

const fmt = (n: number) => n.toLocaleString('en-US');

interface AccountsOrdersTabProps {
  filtered: OrderRow[];
  services: DbService[];
  paymentFilter: string;
  setPaymentFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  serviceFilter: string;
  setServiceFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
  serviceRevenue: ServiceRevenueEntry[];
  topCustomers: TopCustomerEntry[];
  editingPayment: string | null;
  setEditingPayment: (id: string | null) => void;
  editAmount: string;
  setEditAmount: (v: string) => void;
  revenueOf: (order: OrderRow) => number;
  costOf: (order: OrderRow) => number;
  quantityOf: (order: OrderRow) => number;
  serviceTypesOf: (order: OrderRow) => string[];
  SERVICE_LABELS: Record<string, string>;
  onUpdatePayment: (orderId: string, amount: number, orderTotal: number) => Promise<void>;
  onMarkPaid: (orderId: string, orderTotal: number) => Promise<void>;
  onExportCSV: () => void;
}

export function AccountsOrdersTab({
  filtered, services,
  paymentFilter, setPaymentFilter,
  searchQuery, setSearchQuery,
  serviceFilter, setServiceFilter,
  statusFilter, setStatusFilter,
  sortBy, setSortBy,
  paidCount, unpaidCount, partialCount,
  serviceRevenue, topCustomers,
  editingPayment, setEditingPayment, editAmount, setEditAmount,
  revenueOf, costOf, quantityOf, serviceTypesOf,
  SERVICE_LABELS,
  onUpdatePayment, onMarkPaid, onExportCSV,
}: AccountsOrdersTabProps) {
  return (
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
            <Button onClick={onExportCSV} variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
              <Download className="w-3.5 h-3.5" />
              تصدير CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[180px] sm:max-w-xs">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو رقم الطلب..." className="pr-9 h-9 text-xs rounded-lg" />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs rounded-lg"><SelectValue placeholder="الخدمة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الخدمات</SelectItem>
              {services.map(s => (<SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs rounded-lg"><SelectValue placeholder="حالة الطلب" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'draft').map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs rounded-lg"><SelectValue placeholder="ترتيب" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث</SelectItem>
              <SelectItem value="oldest">الأقدم</SelectItem>
              <SelectItem value="highest">الأعلى قيمة</SelectItem>
              <SelectItem value="lowest">الأقل قيمة</SelectItem>
              <SelectItem value="unpaid_first">غير المدفوع أولاً</SelectItem>
            </SelectContent>
          </Select>
          {(paymentFilter !== 'all' || searchQuery || serviceFilter !== 'all' || statusFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="h-9 text-xs w-full sm:w-auto" onClick={() => { setPaymentFilter('all'); setSearchQuery(''); setServiceFilter('all'); setStatusFilter('all'); }}>
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
                              <Button size="sm" className="h-7 text-[10px] px-2 rounded" onClick={() => onUpdatePayment(order.id, parseInt(editAmount) || 0, orderTotal)}>✓</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] px-1.5 rounded" onClick={() => setEditingPayment(null)}>✗</Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                              {order.payment_status !== 'paid' && orderTotal > 0 && (
                                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 rounded" onClick={() => onMarkPaid(order.id, orderTotal)}>
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
  );
}
