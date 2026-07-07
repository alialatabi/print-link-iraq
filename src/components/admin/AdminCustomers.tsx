import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Search, Users, Package, DollarSign,
  ArrowUpDown, ArrowUp, ArrowDown, Clock,
  Phone, MessageCircle, Trash2, ShieldOff, ShieldCheck,
} from 'lucide-react';
import { formatPhoneDisplay } from '@/lib/phoneUtils';

interface CustomerData {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  province: string | null;
  area: string | null;
  landmark: string | null;
  last_seen: string | null;
  is_active: boolean;
  total_time_seconds: number;
  orderCount: number;
  totalSpent: number;
}

type SortKey = 'display_name' | 'phone' | 'orderCount' | 'totalSpent' | 'last_seen';
type SortDir = 'asc' | 'desc';

const formatLastSeen = (ts: string | null): string => {
  if (!ts) return 'غير معروف';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `منذ ${days} يوم`;
  const months = Math.floor(days / 30);
  return `منذ ${months} شهر`;
};

const formatTimeSpent = (seconds: number): string => {
  if (seconds < 60) return 'أقل من دقيقة';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hrs < 24) return `${hrs} ساعة ${remainMins > 0 ? `و ${remainMins} د` : ''}`;
  const days = Math.floor(hrs / 24);
  const remainHrs = hrs % 24;
  return `${days} يوم ${remainHrs > 0 ? `و ${remainHrs} س` : ''}`;
};

// Local alias — call sites stay unchanged; implementation is now in @/lib/phoneUtils.
const formatPhone = formatPhoneDisplay;

const AdminCustomers = () => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('orderCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const loadCustomers = useCallback(async () => {
    // Pull customer + admin roles together so we can keep staff out of the customers list:
    // a user with the admin role (or the super-admin flag) never shows here even if they also
    // carry the default 'customer' role.
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['customer', 'admin']);

    const adminIds = new Set((roleData || []).filter(r => r.role === 'admin').map(r => r.user_id));
    const customerIds = [...new Set(
      (roleData || []).filter(r => r.role === 'customer' && !adminIds.has(r.user_id)).map(r => r.user_id)
    )];
    if (customerIds.length === 0) { setCustomers([]); setLoading(false); return; }

    const [{ data: profiles }, { data: orders }] = await Promise.all([
      supabase.from('profiles').select('*').in('user_id', customerIds),
      supabase.from('orders').select('customer_id, paid_amount').in('customer_id', customerIds),
    ]);

    const customerMap: CustomerData[] = (profiles || [])
      // Belt-and-braces: also drop any super admin (they should already be excluded by the admin role).
      .filter(p => (p as { is_super_admin?: boolean }).is_super_admin !== true)
      .map(p => {
      const customerOrders = (orders || []).filter(o => o.customer_id === p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        phone: p.phone,
        province: p.province,
        area: p.area,
        landmark: p.landmark,
        last_seen: p.last_seen ?? null,
        is_active: p.is_active,
        total_time_seconds: p.total_time_seconds ?? 0,
        orderCount: customerOrders.length,
        totalSpent: customerOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0),
      };
    });

    customerMap.sort((a, b) => b.orderCount - a.orderCount);
    setCustomers(customerMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const handleBlock = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !currentActive })
      .eq('user_id', userId);
    if (error) { toast.error('فشل تحديث حالة الزبون'); return; }
    toast.success(currentActive ? 'تم حظر الزبون' : 'تم رفع الحظر');
    loadCustomers();
  };

  const handleDelete = async (userId: string) => {
    const { error } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId },
    });
    if (error) { toast.error('فشل حذف الحساب'); return; }
    toast.success('تم حذف حساب الزبون');
    loadCustomers();
  };

  const fmt = (n: number) => n.toLocaleString('en-US');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  // Shared per-row derived data — used by both the desktop table row and the mobile card.
  const getContactInfo = (c: CustomerData) => {
    const phone = formatPhone(c.phone);
    const waLink = phone ? `https://wa.me/${phone.replace('+', '')}` : null;
    const telLink = phone ? `tel:${phone}` : null;
    const isOnline = c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < 3 * 60 * 1000;
    const address = [c.province, c.area, c.landmark].filter(Boolean).join(' - ');
    return { phone, waLink, telLink, isOnline, address };
  };

  // Shared actions cluster (call / whatsapp / block / delete) — used by both the table row and the mobile card.
  const renderCustomerActions = (c: CustomerData, telLink: string | null, waLink: string | null) => (
    <div className="flex items-center gap-1 flex-wrap">
      {telLink ? (
        <a href={telLink}>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-success hover:bg-success/10 hover:text-success" title="اتصال">
            <Phone className="w-3.5 h-3.5" />
          </Button>
        </a>
      ) : (
        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-30" disabled title="لا يوجد رقم">
          <Phone className="w-3.5 h-3.5" />
        </Button>
      )}
      {waLink ? (
        <a href={waLink} target="_blank" rel="noopener noreferrer">
          <Button size="icon" variant="ghost" className="h-7 w-7 text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]" title="واتساب">
            <MessageCircle className="w-3.5 h-3.5" />
          </Button>
        </a>
      ) : (
        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-30" disabled title="لا يوجد رقم">
          <MessageCircle className="w-3.5 h-3.5" />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className={`h-7 w-7 ${c.is_active ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'}`}
        title={c.is_active ? 'حظر الزبون' : 'رفع الحظر'}
        onClick={() => handleBlock(c.user_id, c.is_active)}
      >
        {c.is_active ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="حذف الحساب">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف حساب الزبون</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف حساب <strong>{c.display_name || c.phone || 'هذا الزبون'}</strong> نهائياً؟<br />
              <span className="text-destructive font-medium">لا يمكن التراجع عن هذا الإجراء.</span> ستبقى طلباته محفوظة في النظام.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(c.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              نعم، حذف الحساب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // Mobile entity card — mirrors the table row's data with a touch-friendly stacked layout.
  const renderCustomerCard = (c: CustomerData) => {
    const { waLink, telLink, isOnline, address } = getContactInfo(c);
    return (
      <div key={c.user_id} className={`bg-card rounded-xl border border-border p-3 space-y-2 ${!c.is_active ? 'opacity-60 bg-destructive/5' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-success' : 'bg-muted-foreground/30'}`} title={isOnline ? 'متصل الآن' : 'غير متصل'} />
            {!c.is_active && (
              <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium shrink-0">محظور</span>
            )}
            <p className="text-sm font-medium text-foreground truncate min-w-0">{c.display_name || '-'}</p>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">{c.orderCount}</Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate" dir="ltr">{c.phone || '-'}</p>
        {address && <p className="text-xs text-muted-foreground truncate">{address}</p>}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-success">{fmt(c.totalSpent)} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span></span>
          {c.last_seen ? (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              {formatLastSeen(c.last_seen)}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/50">-</span>
          )}
        </div>
        {c.total_time_seconds > 0 && (
          <p className="text-[11px] text-muted-foreground">⏱️ {formatTimeSpent(c.total_time_seconds)}</p>
        )}
        <div className="pt-2 border-t border-border/60">
          {renderCustomerActions(c, telLink, waLink)}
        </div>
      </div>
    );
  };

  let filtered = customers;
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(c =>
      (c.display_name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.province || '').toLowerCase().includes(q) ||
      (c.area || '').toLowerCase().includes(q)
    );
  }

  filtered = [...filtered].sort((a, b) => {
    let valA: string | number; let valB: string | number;
    if (sortKey === 'display_name') { valA = (a.display_name || '').toLowerCase(); valB = (b.display_name || '').toLowerCase(); }
    else if (sortKey === 'phone') { valA = a.phone || ''; valB = b.phone || ''; }
    else if (sortKey === 'last_seen') { valA = a.last_seen ? new Date(a.last_seen).getTime() : 0; valB = b.last_seen ? new Date(b.last_seen).getTime() : 0; }
    else { valA = String(a[sortKey] ?? ''); valB = String(b[sortKey] ?? ''); }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalCustomers = customers.length;
  const totalSpentAll = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalOrdersAll = customers.reduce((s, c) => s + c.orderCount, 0);

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'عدد الزبائن', value: totalCustomers, icon: Users, bg: 'bg-primary/10', color: 'text-primary' },
          { label: 'إجمالي الطلبات', value: totalOrdersAll, icon: Package, bg: 'bg-cmyk-cyan/10', color: 'text-cmyk-cyan' },
          { label: 'إجمالي المدفوعات', value: `${fmt(totalSpentAll)} د.ع`, icon: DollarSign, bg: 'bg-success/10', color: 'text-success' },
        ].map((stat, i) => (
          <div key={stat.label} className={`bg-card rounded-xl p-3 sm:p-4 border border-border min-w-0 ${i === 2 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground truncate">{stat.value}</p>
            <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف أو المنطقة..."
          className="pr-9 rounded-lg"
        />
      </div>

      {/* Table (desktop/tablet) + card list (mobile) */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">لا يوجد زبائن</p>
        </div>
      ) : (
        <>
          {/* Mobile: entity card list */}
          <div className="md:hidden space-y-2">
            {filtered.map((c) => renderCustomerCard(c))}
          </div>

          {/* Desktop/tablet: full table */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-right text-[11px] font-semibold cursor-pointer select-none" onClick={() => handleSort('display_name')}>
                      <span className="inline-flex items-center gap-1">الاسم <SortIcon col="display_name" /></span>
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold cursor-pointer select-none" onClick={() => handleSort('phone')}>
                      <span className="inline-flex items-center gap-1">الهاتف <SortIcon col="phone" /></span>
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold">العنوان</TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[70px] cursor-pointer select-none" onClick={() => handleSort('orderCount')}>
                      <span className="inline-flex items-center gap-1">الطلبات <SortIcon col="orderCount" /></span>
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[100px] cursor-pointer select-none" onClick={() => handleSort('totalSpent')}>
                      <span className="inline-flex items-center gap-1">المدفوع <SortIcon col="totalSpent" /></span>
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[100px] cursor-pointer select-none" onClick={() => handleSort('last_seen')}>
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> آخر نشاط <SortIcon col="last_seen" /></span>
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[90px]">
                      <span className="inline-flex items-center gap-1">⏱️ وقت التصفح</span>
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold w-[160px]">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const { waLink, telLink, isOnline, address } = getContactInfo(c);

                    return (
                      <TableRow key={c.user_id} className={!c.is_active ? 'opacity-60 bg-destructive/5' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-success' : 'bg-muted-foreground/30'}`} title={isOnline ? 'متصل الآن' : 'غير متصل'} />
                            {!c.is_active && (
                              <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium">محظور</span>
                            )}
                            <p className="text-sm font-medium text-foreground">{c.display_name || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground font-mono" dir="ltr">{c.phone || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs text-muted-foreground max-w-[160px] truncate">{address || '-'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{c.orderCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-bold text-success">{fmt(c.totalSpent)} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span></span>
                        </TableCell>
                        <TableCell>
                          {c.last_seen ? (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              {formatLastSeen(c.last_seen)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/50">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] text-muted-foreground">
                            {c.total_time_seconds > 0 ? formatTimeSpent(c.total_time_seconds) : '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {renderCustomerActions(c, telLink, waLink)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">عرض {filtered.length} من {customers.length} زبون</p>
    </div>
  );
};

export default AdminCustomers;
