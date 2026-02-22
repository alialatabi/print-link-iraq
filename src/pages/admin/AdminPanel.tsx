import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusBadge from '@/components/StatusBadge';
import { STATUS_LABELS, OrderStatus } from '@/data/mockData';
import { useServices, buildLabelMap } from '@/hooks/useServices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Package, Users, BarChart3, ClipboardList,
  Trash2, Palette, User, LayoutGrid,
  ShieldCheck, Search, Calendar, ArrowUpDown,
  TrendingUp, Clock, CheckCircle, Truck, FileText, Download,
  WifiOff, XCircle, MapPin, Phone, ChevronDown, ChevronUp
} from 'lucide-react';

import AdminTemplates from '@/components/admin/AdminTemplates';
import AdminAccounts from '@/components/admin/AdminAccounts';
import AdminCustomers from '@/components/admin/AdminCustomers';
import AdminServicesSpecs from '@/components/admin/AdminServicesSpecs';

const ORDER_STATUSES: OrderStatus[] = [
  'draft', 'submitted', 'assigned', 'design_uploaded',
  'waiting_approval', 'approved', 'print_ready', 'printed', 'delivered', 'cancelled'
];

const AdminPanel = () => {
  const { role, isSuperAdmin } = useAuth();
  const { services } = useServices();
  const SERVICE_LABELS = buildLabelMap(services);
  const [orders, setOrders] = useState<any[]>([]);
  const [designers, setDesigners] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [designerFilter, setDesignerFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  // Quick stat filter: overrides statusFilter when set
  type QuickFilter = 'all' | 'pending' | 'inprogress' | 'completed' | null;
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);

  // Admin management (super admin only)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({ phone: '', display_name: '', password: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Designer management
  const [designerDialogOpen, setDesignerDialogOpen] = useState(false);
  const [designerForm, setDesignerForm] = useState({ phone: '', display_name: '', password: '' });
  const [creatingDesigner, setCreatingDesigner] = useState(false);

  const loadOrders = useCallback(async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, templates(name, service_type)')
      .order('created_at', { ascending: false });
    
    if (!ordersData || ordersData.length === 0) {
      setOrders([]);
      return;
    }

    // Fetch customer profiles separately
    const customerIds = [...new Set(ordersData.map(o => o.customer_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, display_name, phone')
      .in('user_id', customerIds);
    
    const profileMap = new Map((profilesData || []).map(p => [p.user_id, p]));
    
    const enrichedOrders = ordersData.map(o => ({
      ...o,
      profiles: profileMap.get(o.customer_id) || null,
    }));
    
    setOrders(enrichedOrders);
  }, []);

  const loadDesigners = useCallback(async () => {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'designer');
    if (roleData && roleData.length > 0) {
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);
      setDesigners(profiles || []);
    } else {
      setDesigners([]);
    }
  }, []);

  const handleToggleDesignerActive = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !currentActive } as any)
      .eq('user_id', userId);
    if (error) { toast.error('فشل تحديث حالة المصمم'); return; }
    toast.success(!currentActive ? 'تم تفعيل المصمم' : 'تم تعطيل المصمم');
    loadDesigners();
  };

  const loadAllUsers = useCallback(async () => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role');
    const userIds = [...new Set((roles || []).map(r => r.user_id))];
    if (userIds.length === 0) { setAllUsers([]); return; }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', userIds);
    const userMap = (profiles || []).map(p => ({
      ...p,
      roles: (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role)
    }));
    setAllUsers(userMap);
  }, []);

  const loadOnlineCount = useCallback(async () => {
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', threeMinAgo);
    setOnlineCount(count || 0);
  }, []);

  useEffect(() => {
    Promise.all([loadOrders(), loadDesigners(), loadAllUsers(), loadOnlineCount()]).then(() => setLoading(false));
  }, [loadOrders, loadDesigners, loadAllUsers, loadOnlineCount]);

  // Realtime subscriptions for live updates
  useEffect(() => {
    const profilesChannel = supabase
      .channel('online-count')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => { loadOnlineCount(); })
      .subscribe();

    const ordersChannel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadOrders(); })
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(ordersChannel);
    };
  }, [loadOnlineCount, loadOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus as any })
      .eq('id', orderId);
    if (error) { toast.error('فشل تحديث الحالة'); return; }
    toast.success('تم تحديث الحالة');
    loadOrders();
  };

  const handleCancelOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' as any, designer_id: null })
      .eq('id', orderId);
    if (error) { toast.error('فشل إلغاء الطلب'); return; }
    toast.success('تم إلغاء الطلب');
    loadOrders();
  };

  const handleAssignDesigner = async (orderId: string, designerId: string) => {
    const updateData: any = { designer_id: designerId };
    // If order is submitted and we're assigning, change to assigned
    const order = orders.find(o => o.id === orderId);
    if (order && order.status === 'submitted') {
      updateData.status = 'assigned';
    }
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);
    if (error) { toast.error('فشل تعيين المصمم'); return; }
    toast.success('تم تعيين المصمم');
    loadOrders();
  };

  const ROLE_LABELS: Record<string, string> = { customer: 'زبون', designer: 'مصمم', admin: 'أدمن' };

  const handleToggleRole = async (userId: string, role: string, hasRole: boolean) => {
    const targetUser = allUsers.find(u => u.user_id === userId);
    // Protect super admin
    if (targetUser && isSuperAdminPhone(targetUser.phone) && role === 'admin' && hasRole) {
      toast.error('لا يمكن إزالة دور الأدمن من السوبر أدمن');
      return;
    }
    // Restrict admin role toggle to super admin only
    if (role === 'admin' && !isSuperAdmin) {
      toast.error('فقط السوبر أدمن يمكنه تعديل دور الأدمن');
      return;
    }
    try {
      if (hasRole) {
        // Remove role
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role as any);
        if (error) throw error;
        toast.success(`تم إزالة دور ${ROLE_LABELS[role]}`);
      } else {
        // Add role
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: role } as any);
        if (error) {
          if (error.code === '23505') { toast.error('الدور موجود مسبقاً'); return; }
          throw error;
        }
        toast.success(`تم إضافة دور ${ROLE_LABELS[role]}`);
      }
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (err: any) {
      toast.error(err.message || 'فشل تعديل الدور');
    }
  };

  const isSuperAdminPhone = (phone: string | null) => {
    if (!phone) return false;
    const normalize = (p: string) => p.replace(/\D/g, '').replace(/^964/, '0').replace(/^00/, '0');
    return normalize(phone) === '07838774435';
  };


  const handleCreateAdmin = async () => {
    if (!adminForm.phone.trim()) { toast.error('رقم الهاتف مطلوب'); return; }
    if (!adminForm.password || adminForm.password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setCreatingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {
          phone: adminForm.phone.trim(),
          display_name: adminForm.display_name.trim() || undefined,
          password: adminForm.password,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.is_new ? 'تم إنشاء حساب الأدمن بنجاح' : 'تم تحديث صلاحيات الحساب');
      setAdminDialogOpen(false);
      setAdminForm({ phone: '', display_name: '', password: '' });
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (err: any) {
      toast.error(err.message || 'فشل إنشاء حساب الأدمن');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleCreateDesigner = async () => {
    if (!designerForm.phone.trim()) { toast.error('رقم الهاتف مطلوب'); return; }
    if (!designerForm.password || designerForm.password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setCreatingDesigner(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-designer', {
        body: {
          phone: designerForm.phone.trim(),
          display_name: designerForm.display_name.trim() || undefined,
          password: designerForm.password,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.is_new ? 'تم إنشاء حساب المصمم بنجاح' : 'تم تحديث صلاحيات الحساب');
      setDesignerDialogOpen(false);
      setDesignerForm({ phone: '', display_name: '', password: '' });
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (err: any) {
      toast.error(err.message || 'فشل إنشاء حساب المصمم');
    } finally {
      setCreatingDesigner(false);
    }
  };

  const handleDeleteDesigner = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('تم حذف حساب المصمم');
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (err: any) {
      toast.error(err.message || 'فشل حذف الحساب');
    }
  };

  const handleExportPrintedOrders = () => {
    const printedOrders = orders.filter(o => o.status === 'printed' || o.status === 'delivered');
    if (printedOrders.length === 0) {
      toast.error('لا توجد طلبات مطبوعة للتصدير');
      return;
    }

    const exportData = printedOrders.map((o, i) => {
      const details = (o.details || {}) as Record<string, any>;
      return {
        '#': i + 1,
        'اسم الزبون': o.profiles?.display_name || details.name || '-',
        'رقم الهاتف': o.profiles?.phone || details.phone || '-',
        'العنوان': details.address || '-',
        'البريد الإلكتروني': details.email || '-',
        'نوع الخدمة': SERVICE_LABELS[o.templates?.service_type] || '-',
        'اسم القالب': o.templates?.name || '-',
        'الحالة': STATUS_LABELS[o.status as OrderStatus] || o.status,
        'تاريخ الطلب': new Date(o.created_at).toLocaleDateString('ar'),
      };
    });

    const headers = Object.keys(exportData[0]);
    const csvRows = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(h => {
          const val = String((row as any)[h] ?? '').replace(/"/g, '""');
          return `"${val}"`;
        }).join(',')
      ),
    ];
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `طلبات_مطبوعة_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير ${printedOrders.length} طلب`);
  };

  if (role !== 'admin') {
    return <div className="py-20 text-center"><p className="text-destructive text-lg">ليس لديك صلاحية الوصول</p></div>;
  }

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;

  // Filtering & sorting
  let filteredOrders = orders;

  // Quick filter from stat cards overrides statusFilter
  if (quickFilter === 'pending') filteredOrders = filteredOrders.filter(o => ['submitted', 'draft'].includes(o.status));
  else if (quickFilter === 'inprogress') filteredOrders = filteredOrders.filter(o => ['assigned', 'design_uploaded', 'waiting_approval'].includes(o.status));
  else if (quickFilter === 'completed') filteredOrders = filteredOrders.filter(o => ['approved', 'print_ready', 'printed', 'delivered'].includes(o.status));
  else if (statusFilter !== 'all') filteredOrders = filteredOrders.filter(o => o.status === statusFilter);

  if (serviceFilter !== 'all') filteredOrders = filteredOrders.filter(o => o.templates?.service_type === serviceFilter);
  if (designerFilter !== 'all') {
    if (designerFilter === 'unassigned') filteredOrders = filteredOrders.filter(o => !o.designer_id);
    else filteredOrders = filteredOrders.filter(o => o.designer_id === designerFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filteredOrders = filteredOrders.filter(o =>
      (o.profiles?.display_name || '').toLowerCase().includes(q) ||
      (o.profiles?.phone || '').includes(q) ||
      (o.templates?.name || '').toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  }
  if (sortBy === 'oldest') filteredOrders = [...filteredOrders].reverse();

  // Stats
  const totalOrders = orders.filter(o => o.status !== 'cancelled').length;
  const pendingOrders = orders.filter(o => ['submitted', 'draft'].includes(o.status)).length;
  const inProgressOrders = orders.filter(o => ['assigned', 'design_uploaded', 'waiting_approval'].includes(o.status)).length;
  const completedOrders = orders.filter(o => ['approved', 'print_ready', 'printed', 'delivered'].includes(o.status)).length;

  // Designer workload
  const designerWorkload = designers.map(d => ({
    ...d,
    activeOrders: orders.filter(o => o.designer_id === d.user_id && !['delivered', 'draft', 'cancelled'].includes(o.status)).length,
    totalOrders: orders.filter(o => o.designer_id === d.user_id).length,
    completedOrders: orders.filter(o => o.designer_id === d.user_id && ['approved', 'print_ready', 'printed', 'delivered'].includes(o.status)).length,
  }));

  return (
    <div className="py-8">
      <div className="container max-w-6xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-primary" />
              لوحة الإدارة
            </h1>
            <p className="text-muted-foreground">إدارة شاملة للطلبات والمستخدمين</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Online visitors indicator */}
            <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-xl px-4 py-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
              <span className="text-sm font-bold text-success">{onlineCount}</span>
              <span className="text-xs text-muted-foreground">متصل الآن</span>
            </div>
            <Button onClick={handleExportPrintedOrders} variant="outline" className="rounded-xl">
              <Download className="w-4 h-4 ml-2" />
              تصدير الطلبات المطبوعة (Excel)
            </Button>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'إجمالي الطلبات', value: totalOrders, icon: Package, color: 'text-primary', bg: 'bg-primary/10', filter: 'all' as const },
            { label: 'بانتظار التعيين', value: pendingOrders, icon: Clock, color: 'text-cmyk-yellow', bg: 'bg-cmyk-yellow/10', filter: 'pending' as const },
            { label: 'قيد التنفيذ', value: inProgressOrders, icon: TrendingUp, color: 'text-cmyk-cyan', bg: 'bg-cmyk-cyan/10', filter: 'inprogress' as const },
            { label: 'مكتملة', value: completedOrders, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', filter: 'completed' as const },
            { label: 'المصممين', value: designers.length, icon: Palette, color: 'text-cmyk-magenta', bg: 'bg-cmyk-magenta/10', filter: null as null },
          ].map((stat) => {
            const isActive = activeTab === 'orders' && (
              (stat.filter === 'all' && quickFilter === null) ||
              (stat.filter !== null && quickFilter === stat.filter)
            );
            return (
              <button
                key={stat.label}
                onClick={() => {
                  if (stat.filter === null) {
                    setActiveTab('designers');
                  } else {
                    setActiveTab('orders');
                    setQuickFilter(stat.filter === 'all' ? null : stat.filter);
                    setStatusFilter('all');
                  }
                }}
                className={`bg-card rounded-xl p-4 border text-right transition-all hover:shadow-md active:scale-[0.98] cursor-pointer ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </button>
            );
          })}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setQuickFilter(null); }} dir="rtl">
          <TabsList className={`grid w-full mb-6 ${isSuperAdmin ? 'grid-cols-8' : 'grid-cols-7'}`}>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">الطلبات</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">الحسابات</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">القوالب</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">الخدمات</span>
            </TabsTrigger>
            <TabsTrigger value="designers" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">المصممين</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">الزبائن</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">المستخدمين</span>
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="admins" className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">الأدمنز</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* ORDERS TAB */}
          <TabsContent value="orders">
            {/* Advanced Filters */}
            <div className="bg-card rounded-xl p-4 border border-border mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث بالاسم أو الهاتف..."
                    className="pr-9 rounded-lg"
                  />
                </div>
                {/* Status */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    {ORDER_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]} ({orders.filter(o => o.status === s).length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Service */}
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
                {/* Designer */}
                <Select value={designerFilter} onValueChange={setDesignerFilter}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="المصمم" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المصممين</SelectItem>
                    <SelectItem value="unassigned">غير معيّن</SelectItem>
                    {designers.map(d => (
                      <SelectItem key={d.user_id} value={d.user_id}>
                        {d.display_name || d.phone || 'مصمم'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="الترتيب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">الأحدث أولاً</SelectItem>
                    <SelectItem value="oldest">الأقدم أولاً</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">عرض {filteredOrders.length} من {orders.length} طلب</span>
                {quickFilter && (
                  <button
                    onClick={() => setQuickFilter(null)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <span>✕</span>
                    مسح فلتر: {quickFilter === 'pending' ? 'بانتظار التعيين' : quickFilter === 'inprogress' ? 'قيد التنفيذ' : 'مكتملة'}
                  </button>
                )}
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">لا توجد طلبات مطابقة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order, i) => {
                  const details = (order.details || {}) as Record<string, any>;
                  const DETAIL_LABELS: Record<string, string> = {
                    name: 'الاسم', phone: 'الهاتف', job_title: 'المسمى الوظيفي',
                    address: 'العنوان', email: 'البريد', notes: 'ملاحظات',
                    quantity: 'الكمية', delivery_phone: 'هاتف التوصيل',
                    delivery_province: 'المحافظة', delivery_area: 'المنطقة',
                    delivery_landmark: 'أقرب نقطة دالة', delivery_label: 'عنوان التوصيل',
                    approved_at: 'تاريخ الموافقة',
                  };
                  const deliveryKeys = ['delivery_province', 'delivery_area', 'delivery_landmark', 'delivery_label', 'delivery_phone'];
                  const hasDelivery = deliveryKeys.some(k => details[k]);
                  const contentFields = Object.entries(details)
                    .filter(([key, val]) => !deliveryKeys.includes(key) && key !== 'approved_at' && val && typeof val !== 'object')
                    .map(([key, val]) => ({ key, label: DETAIL_LABELS[key] || key, value: String(val) }));
                  const deliveryFields = deliveryKeys
                    .filter(k => details[k])
                    .map(k => ({ key: k, label: DETAIL_LABELS[k] || k, value: String(details[k]) }));

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.3) }}
                      className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden"
                    >
                      {/* Card Header */}
                      <div className="p-4 pb-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-bold text-foreground text-sm leading-tight">{order.templates?.name || '-'}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {SERVICE_LABELS[order.templates?.service_type] || ''} · <span className="font-mono">#{order.id.slice(0, 8)}</span>
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={order.status as OrderStatus} />
                        </div>

                        {/* Customer info row */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            {order.profiles?.display_name || '-'}
                          </span>
                          <span className="flex items-center gap-1.5" dir="ltr">
                            <Phone className="w-3.5 h-3.5" />
                            {order.profiles?.phone || '-'}
                          </span>
                          <span className="flex items-center gap-1.5 mr-auto">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(order.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      {/* Content Details */}
                      {contentFields.length > 0 && (
                        <div className="px-4 pb-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                            {contentFields.map(f => (
                              <div key={f.key}>
                                <span className="text-muted-foreground">{f.label}</span>
                                <p className="text-foreground font-medium truncate">{f.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Delivery Info */}
                      {hasDelivery && (
                        <div className="mx-4 mb-3 bg-primary/5 border border-primary/10 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                            <MapPin className="w-3.5 h-3.5" />
                            معلومات التوصيل
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                            {deliveryFields.map(f => (
                              <div key={f.key}>
                                <span className="text-muted-foreground">{f.label}</span>
                                <p className="text-foreground font-medium">{f.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="border-t border-border bg-muted/20 px-4 py-3 flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4 text-muted-foreground" />
                          <Select
                            value={order.designer_id || 'none'}
                            onValueChange={(val) => {
                              if (val !== 'none') handleAssignDesigner(order.id, val);
                            }}
                          >
                            <SelectTrigger className="w-40 h-8 text-xs rounded-lg">
                              <SelectValue placeholder="تعيين مصمم" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" disabled>اختر مصمم</SelectItem>
                              {designers.map(d => (
                                <SelectItem key={d.user_id} value={d.user_id}>
                                  {(d as any).is_active === false ? '🔴 ' : '🟢 '}
                                  {d.display_name || d.phone || 'مصمم'}
                                  {' '}({designerWorkload.find(w => w.user_id === d.user_id)?.activeOrders || 0} نشط)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <Select
                            value={order.status}
                            onValueChange={(val) => handleStatusChange(order.id, val)}
                          >
                            <SelectTrigger className="w-40 h-8 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {order.status !== 'draft' && order.status !== 'delivered' && order.status !== 'cancelled' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 gap-1.5 mr-auto">
                                <XCircle className="w-3.5 h-3.5" />
                                إلغاء الطلب
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>إلغاء الطلب</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من إلغاء طلب <strong>{order.profiles?.display_name || order.profiles?.phone || 'هذا الزبون'}</strong>؟
                                  سيتم إعادة حالته إلى مسودة وإلغاء تعيين المصمم.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>تراجع</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancelOrder(order.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  نعم، إلغاء الطلب
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ACCOUNTS TAB */}
          <TabsContent value="accounts">
            <AdminAccounts />
          </TabsContent>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates">
            <AdminTemplates />
          </TabsContent>

          {/* SERVICES & SPECIALIZATIONS TAB */}
          <TabsContent value="services">
            <AdminServicesSpecs />
          </TabsContent>

          {/* DESIGNERS TAB */}
          <TabsContent value="designers">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground">أداء المصممين</h3>
              {designerWorkload.length === 0 ? (
                <div className="text-center py-16">
                  <Palette className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">لا يوجد مصممين بعد</p>
                  <p className="text-muted-foreground text-sm mt-1">أضف دور "مصمم" لأحد المستخدمين من تبويب المستخدمين</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {designerWorkload.map((d) => {
                    const isActive = (d as any).is_active !== false;
                    const lastSeen = (d as any).last_seen ? new Date((d as any).last_seen) : null;
                    const isOnline = lastSeen && (Date.now() - lastSeen.getTime()) < 3 * 60 * 1000; // 3 minutes
                    return (
                    <div key={d.user_id} className={`bg-card rounded-xl p-5 border transition-all ${isActive ? 'border-border' : 'border-destructive/30 opacity-70'}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOnline ? 'bg-success/10' : isActive ? 'bg-cmyk-magenta/10' : 'bg-muted'}`}>
                              {isOnline
                                ? <Palette className="w-5 h-5 text-success" />
                                : isActive
                                  ? <Palette className="w-5 h-5 text-cmyk-magenta" />
                                  : <WifiOff className="w-5 h-5 text-muted-foreground" />
                              }
                            </div>
                            {/* Online indicator dot */}
                            <span className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${isOnline ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-foreground">{d.display_name || d.phone || 'مصمم'}</h4>
                              <Badge variant={isOnline ? 'default' : 'outline'} className={`text-[10px] px-1.5 py-0 ${isOnline ? 'bg-success/15 text-success border-success/30' : 'text-muted-foreground'}`}>
                                {isOnline ? 'متصل الآن' : 'غير متصل'}
                              </Badge>
                            </div>
                            {d.phone && <p className="text-xs text-muted-foreground" dir="ltr">{d.phone}</p>}
                            {lastSeen && !isOnline && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                آخر ظهور: {lastSeen.toLocaleDateString('ar')} {lastSeen.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Toggle active */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{isActive ? 'يستقبل طلبات' : 'موقوف'}</span>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => handleToggleDesignerActive(d.user_id, isActive)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-primary/5 rounded-lg p-3">
                          <p className="text-xl font-bold text-primary">{d.activeOrders}</p>
                          <p className="text-xs text-muted-foreground">نشطة</p>
                        </div>
                        <div className="bg-success/5 rounded-lg p-3">
                          <p className="text-xl font-bold text-success">{d.completedOrders}</p>
                          <p className="text-xs text-muted-foreground">مكتملة</p>
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-xl font-bold text-foreground">{d.totalOrders}</p>
                          <p className="text-xs text-muted-foreground">الإجمالي</p>
                        </div>
                      </div>

                      {/* Workload bar */}
                      {isActive && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>عبء العمل</span>
                            <span>{d.activeOrders} طلبات نشطة</span>
                          </div>
                          <div className="bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${d.activeOrders > 5 ? 'bg-destructive' : d.activeOrders > 3 ? 'bg-cmyk-yellow' : 'bg-success'}`}
                              style={{ width: `${Math.min(d.activeOrders * 15, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {!isActive && (
                        <div className="mt-4 bg-destructive/5 rounded-lg p-3 text-center">
                          <p className="text-xs text-destructive">هذا المصمم لا يستقبل طلبات جديدة تلقائياً</p>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Service Distribution */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">توزيع الطلبات حسب الخدمة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(SERVICE_LABELS).map(([key, label]) => {
                      const count = orders.filter(o => o.templates?.service_type === key).length;
                      const percentage = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-24 text-left">{label}</span>
                          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                            <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${percentage}%` }} />
                          </div>
                          <span className="text-sm font-bold text-foreground w-8">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* CUSTOMERS TAB */}
          <TabsContent value="customers">
            <AdminCustomers />
          </TabsContent>

          {/* USERS TAB - Designers management only */}
          <TabsContent value="users">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary" />
                    إدارة المصممين
                  </h3>
                  <p className="text-sm text-muted-foreground">إضافة وحذف المصممين وتغيير صلاحياتهم</p>
                </div>
                <Button onClick={() => setDesignerDialogOpen(true)} className="rounded-xl gap-1.5">
                  <Palette className="w-4 h-4" />
                  إضافة مصمم جديد
                </Button>
              </div>

              {allUsers.filter(u => u.roles.includes('designer')).length === 0 ? (
                <div className="text-center py-16">
                  <Palette className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">لا يوجد مصممين</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allUsers.filter(u => u.roles.includes('designer')).map((u, i) => (
                    <motion.div
                      key={u.user_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className="bg-card rounded-xl p-4 border border-border shadow-sm"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-secondary/30 flex items-center justify-center">
                            <Palette className="w-5 h-5 text-secondary-foreground" />
                          </div>
                          <div>
                            <h4 className="font-bold text-foreground text-sm">
                              {u.display_name || u.phone || 'مستخدم'}
                            </h4>
                            {u.phone && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{u.phone}</p>}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {u.roles.map((r: string) => (
                                <Badge key={r} variant={r === 'admin' ? 'default' : r === 'designer' ? 'secondary' : 'outline'} className="text-[10px]">
                                  {r === 'admin' ? 'أدمن' : r === 'designer' ? 'مصمم' : 'زبون'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(['customer', 'designer', ...(isSuperAdmin ? ['admin'] : [])] as string[]).map(role => {
                            const has = u.roles.includes(role);
                            return (
                              <button
                                key={role}
                                onClick={() => handleToggleRole(u.user_id, role, has)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                  has
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-muted/50 border-border text-muted-foreground hover:border-primary/30'
                                }`}
                              >
                                {has ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current" />}
                                {ROLE_LABELS[role]}
                              </button>
                            );
                          })}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-xs h-8 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10">
                                <Trash2 className="w-3 h-3 ml-1" />
                                حذف
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف حساب المصمم</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل أنت متأكد من حذف حساب "{u.display_name || u.phone}"؟ سيتم حذف الحساب نهائياً.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteDesigner(u.user_id)} className="bg-destructive hover:bg-destructive/90">
                                  حذف نهائي
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Designer Dialog */}
            <Dialog open={designerDialogOpen} onOpenChange={setDesignerDialogOpen}>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة حساب مصمم جديد</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">رقم الهاتف *</label>
                    <Input
                      value={designerForm.phone}
                      onChange={e => setDesignerForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="07xxxxxxxxx"
                      className="rounded-xl"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">الاسم</label>
                    <Input
                      value={designerForm.display_name}
                      onChange={e => setDesignerForm(f => ({ ...f, display_name: e.target.value }))}
                      placeholder="اسم المصمم"
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">كلمة المرور *</label>
                    <Input
                      type="password"
                      value={designerForm.password}
                      onChange={e => setDesignerForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="6 أحرف على الأقل"
                      className="rounded-xl"
                      dir="ltr"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3">
                    سيتم إنشاء حساب مصمم جديد. يمكن للمصمم تسجيل الدخول عبر صفحة طاقم العمل باستخدام رقم الهاتف وكلمة المرور.
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleCreateDesigner} disabled={creatingDesigner} className="flex-1 rounded-xl">
                      {creatingDesigner ? 'جاري الإنشاء...' : 'إنشاء حساب مصمم'}
                    </Button>
                    <Button variant="outline" onClick={() => setDesignerDialogOpen(false)} disabled={creatingDesigner} className="rounded-xl">
                      إلغاء
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ADMINS TAB - Super Admin Only */}
          {isSuperAdmin && (
            <TabsContent value="admins">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      إدارة حسابات الأدمن
                    </h3>
                    <p className="text-sm text-muted-foreground">هذه الصفحة متاحة فقط للسوبر أدمن</p>
                  </div>
                  <Button onClick={() => setAdminDialogOpen(true)} className="rounded-xl gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    إضافة أدمن جديد
                  </Button>
                </div>

                {/* Current admins list */}
                <div className="space-y-3">
                  {allUsers.filter(u => u.roles.includes('admin')).map((u, i) => {
                    const isSuperAdminUser = isSuperAdminPhone(u.phone);
                    return (
                      <motion.div
                        key={u.user_id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.3) }}
                        className="bg-card rounded-xl p-4 border border-border shadow-sm"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSuperAdminUser ? 'bg-primary/15' : 'bg-muted'}`}>
                              <ShieldCheck className={`w-5 h-5 ${isSuperAdminUser ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                                {u.display_name || u.phone || 'مستخدم'}
                                {isSuperAdminUser && (
                                  <Badge variant="default" className="text-[10px]">سوبر أدمن</Badge>
                                )}
                              </h4>
                              {u.phone && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{u.phone}</p>}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {u.roles.map((r: string) => (
                                  <Badge key={r} variant={r === 'admin' ? 'default' : r === 'designer' ? 'secondary' : 'outline'} className="text-[10px]">
                                    {r === 'admin' ? 'أدمن' : r === 'designer' ? 'مصمم' : 'زبون'}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          {!isSuperAdminUser && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {(['customer', 'designer', 'admin'] as string[]).map(role => {
                                const has = u.roles.includes(role);
                                return (
                                  <button
                                    key={role}
                                    onClick={() => handleToggleRole(u.user_id, role, has)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                                      has
                                        ? 'bg-primary/10 border-primary/30 text-primary'
                                        : 'bg-muted/50 border-border text-muted-foreground hover:border-primary/30'
                                    }`}
                                  >
                                    {has ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current" />}
                                    {ROLE_LABELS[role]}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Create Admin Dialog */}
              <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
                <DialogContent className="max-w-md" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة حساب أدمن جديد</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">رقم الهاتف *</label>
                      <Input
                        value={adminForm.phone}
                        onChange={e => setAdminForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="07xxxxxxxxx"
                        className="rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">الاسم</label>
                      <Input
                        value={adminForm.display_name}
                        onChange={e => setAdminForm(f => ({ ...f, display_name: e.target.value }))}
                        placeholder="اسم المستخدم"
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">كلمة المرور *</label>
                      <Input
                        type="password"
                        value={adminForm.password}
                        onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="6 أحرف على الأقل"
                        className="rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3">
                      سيتم إنشاء حساب أدمن جديد. يمكن للمستخدم تسجيل الدخول عبر صفحة طاقم العمل باستخدام رقم الهاتف وكلمة المرور.
                    </p>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleCreateAdmin} disabled={creatingAdmin} className="flex-1 rounded-xl">
                        {creatingAdmin ? 'جاري الإنشاء...' : 'إنشاء حساب أدمن'}
                      </Button>
                      <Button variant="outline" onClick={() => setAdminDialogOpen(false)} disabled={creatingAdmin} className="rounded-xl">
                        إلغاء
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
