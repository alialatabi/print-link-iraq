import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Users, Phone, MapPin, Package, DollarSign } from 'lucide-react';

interface CustomerData {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  province: string | null;
  area: string | null;
  landmark: string | null;
  orderCount: number;
  totalSpent: number;
}

const AdminCustomers = () => {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCustomers = useCallback(async () => {
    // Get all customer role user_ids
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'customer');

    const customerIds = (roleData || []).map(r => r.user_id);
    if (customerIds.length === 0) { setCustomers([]); setLoading(false); return; }

    // Get profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', customerIds);

    // Get orders for these customers
    const { data: orders } = await supabase
      .from('orders')
      .select('customer_id, paid_amount, templates(price)')
      .in('customer_id', customerIds);

    const customerMap = (profiles || []).map(p => {
      const customerOrders = (orders || []).filter(o => o.customer_id === p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        phone: p.phone,
        province: p.province,
        area: p.area,
        landmark: p.landmark,
        orderCount: customerOrders.length,
        totalSpent: customerOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0),
      };
    });

    // Sort by order count descending
    customerMap.sort((a, b) => b.orderCount - a.orderCount);
    setCustomers(customerMap);
    setLoading(false);
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const fmt = (n: number) => n.toLocaleString('ar-IQ');

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

  const totalCustomers = customers.length;
  const totalSpentAll = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalOrdersAll = customers.reduce((s, c) => s + c.orderCount, 0);

  if (loading) return <div className="py-10 text-center text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'عدد الزبائن', value: totalCustomers, icon: Users, bg: 'bg-primary/10', color: 'text-primary' },
          { label: 'إجمالي الطلبات', value: totalOrdersAll, icon: Package, bg: 'bg-cmyk-cyan/10', color: 'text-cmyk-cyan' },
          { label: 'إجمالي المدفوعات', value: `${fmt(totalSpentAll)} د.ع`, icon: DollarSign, bg: 'bg-success/10', color: 'text-success' },
        ].map(stat => (
          <div key={stat.label} className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
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

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">لا يوجد زبائن</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-right text-[11px] font-semibold">الاسم</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold">الهاتف</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold">العنوان</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold w-[80px]">الطلبات</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold w-[100px]">المبلغ المدفوع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c, i) => {
                  const address = [c.province, c.area, c.landmark].filter(Boolean).join(' - ');
                  return (
                    <TableRow key={c.user_id}>
                      <TableCell>
                        <p className="text-sm font-medium text-foreground">{c.display_name || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground font-mono" dir="ltr">{c.phone || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground max-w-[200px] truncate">{address || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{c.orderCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-success">{fmt(c.totalSpent)} <span className="text-[10px] font-normal text-muted-foreground">د.ع</span></span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">عرض {filtered.length} من {customers.length} زبون</p>
    </div>
  );
};

export default AdminCustomers;
