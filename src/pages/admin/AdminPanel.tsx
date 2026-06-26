import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useServices, buildLabelMap } from '@/hooks/useServices';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { getDesignSignedUrl } from '@/lib/storage';
import { ROLE_LABELS } from '@/lib/constants';
import { STATUS_LABELS } from '@/data/mockData';
import type { OrderStatus } from '@/data/mockData';
import type { OrderDetailsJson, OrderStatusEnum, AppRole } from '@/types/db';
import type { AdminOrder, AdminOrderItem, AdminDesign, DesignerProfile, AdminUser, QuickFilter, DesignerWorkloadItem } from '@/components/admin/adminTypes';
import {
  Package, Users, BarChart3, ClipboardList,
  Palette, User, LayoutGrid,
  ShieldCheck,
  TrendingUp, Clock, CheckCircle, Download,
  Percent, Store, Sparkles, Activity,
} from 'lucide-react';

import AdminTemplates from '@/components/admin/AdminTemplates';
import AdminAccounts from '@/components/admin/AdminAccounts';
import AdminCustomers from '@/components/admin/AdminCustomers';
import AdminServicesSpecs from '@/components/admin/AdminServicesSpecs';
import AdminAiUsage from '@/components/admin/AdminAiUsage';
import AdminAiDesigns from '@/components/admin/AdminAiDesigns';
import AdminLocationsSync from '@/components/admin/AdminLocationsSync';
import AdminActivityLog from '@/components/admin/AdminActivityLog';
import AdminDiscounts from '@/components/admin/AdminDiscounts';
import AdminResellers from '@/components/admin/AdminResellers';
import AdminOrdersTab from '@/components/admin/AdminOrdersTab';
import AdminDesignersTab from '@/components/admin/AdminDesignersTab';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminAdminsTab from '@/components/admin/AdminAdminsTab';

const AdminPanel = () => {
  const { role, isSuperAdmin, user } = useAuth();
  const { services } = useServices();
  const SERVICE_LABELS = buildLabelMap(services);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [designers, setDesigners] = useState<DesignerProfile[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
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
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  // Which order cards have their details (items/delivery) expanded.
  const [openOrders, setOpenOrders] = useState<Set<string>>(new Set());

  // Admin management (super admin only)
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({ phone: '', display_name: '', password: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Designer management
  const [designerDialogOpen, setDesignerDialogOpen] = useState(false);
  const [designerForm, setDesignerForm] = useState({ phone: '', display_name: '', password: '' });
  const [creatingDesigner, setCreatingDesigner] = useState(false);

  // Activity logging helper
  const logActivity = useCallback(async (action: string, targetUserId?: string | null, details?: Record<string, unknown>) => {
    if (!user) return;
    try {
      await supabase.from('activity_logs').insert({
        actor_id: user.id,
        action,
        target_user_id: targetUserId || null,
        details: details || {},
      } as never);
    } catch (e) {
      console.error('Failed to log activity', e);
    }
  }, [user]);

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

    // Fetch order_items
    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*, templates(name, service_type)')
      .in('order_id', orderIds);
    const itemsByOrder = new Map<string, AdminOrderItem[]>();
    (itemsData || []).forEach((item) => {
      const list = itemsByOrder.get(item.order_id) || [];
      list.push(item as unknown as AdminOrderItem);
      itemsByOrder.set(item.order_id, list);
    });

    // Fetch designer-produced design files (private 'designs' bucket) so admins can download them.
    const { data: designsData } = await supabase
      .from('designs')
      .select('id, order_id, order_item_id, version, file_url, approved')
      .in('order_id', orderIds)
      .order('version', { ascending: false });
    const designsByOrder = new Map<string, AdminDesign[]>();
    (designsData || []).forEach((d) => {
      const list = designsByOrder.get(d.order_id) || [];
      list.push(d as unknown as AdminDesign);
      designsByOrder.set(d.order_id, list);
    });

    const enrichedOrders = ordersData.map(o => ({
      ...o,
      profiles: profileMap.get(o.customer_id) || null,
      _items: itemsByOrder.get(o.id) || [],
      _designs: designsByOrder.get(o.id) || [],
    }));

    setOrders(enrichedOrders as unknown as AdminOrder[]);
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
      .update({ is_active: !currentActive })
      .eq('user_id', userId);
    if (error) { toast.error('فشل تحديث حالة المصمم'); return; }
    const designer = designers.find(d => d.user_id === userId);
    logActivity('toggle_designer_active', userId, { target_name: designer?.display_name || designer?.phone || '-', new_status: !currentActive ? 'نشط' : 'معطّل', actor_name: 'أدمن' });
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
      .select('*, is_super_admin')
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

  // Force a file download via a transient anchor (URLs already carry an attachment disposition).
  const triggerDownload = (href: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Designer-produced files live in the private 'designs' bucket → sign with a download disposition.
  const downloadDesignFromBucket = async (filePath: string, filename: string) => {
    const url = await getDesignSignedUrl(filePath, filename);
    if (!url) { toast.error('فشل تجهيز رابط التحميل'); return; }
    triggerDownload(url);
  };

  // Uploaded/reseller files are public URLs in 'order-attachments' → add ?download for attachment disposition.
  const downloadDesignFromUrl = (url: string, filename: string) => {
    const sep = url.includes('?') ? '&' : '?';
    triggerDownload(`${url}${sep}download=${encodeURIComponent(filename)}`);
  };

  // Customer-facing push copy per status (only these statuses notify; internal ones stay silent).
  const STATUS_PUSH: Partial<Record<string, { title: string; body: string }>> = {
    waiting_approval: { title: 'تصميمك جاهز ✨', body: 'صار تصميم طلبك جاهز للمراجعة — افتح التطبيق للموافقة' },
    approved: { title: 'تمت الموافقة ✅', body: 'تمت الموافقة على طلبك وراح يدخل مرحلة الطباعة' },
    print_ready: { title: 'جاهز للطباعة 🖨️', body: 'طلبك جاهز للطباعة' },
    printed: { title: 'تمت الطباعة 🖨️', body: 'تمت طباعة طلبك ويتم تجهيزه للتوصيل' },
    delivered: { title: 'تم التسليم 🎉', body: 'تم تسليم طلبك. شكراً لاختيارك مطبعتي' },
    cancelled: { title: 'تم إلغاء الطلب', body: 'تم إلغاء طلبك. لأي استفسار تواصل معنا' },
  };

  // Best-effort push to the customer about their order status (never blocks the status update).
  const notifyCustomer = (customerId: string | null | undefined, orderId: string, status: string) => {
    const msg = STATUS_PUSH[status];
    if (!customerId || !msg) return;
    supabase.functions.invoke('send-push', {
      body: { userId: customerId, title: msg.title, body: msg.body, data: { orderId, status } },
    }).catch(() => { /* push is non-critical */ });
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus as OrderStatusEnum })
      .eq('id', orderId);
    if (error) { toast.error('فشل تحديث الحالة'); return; }
    const order = orders.find(o => o.id === orderId);
    logActivity('change_order_status', order?.customer_id, { order_id: orderId, new_status: newStatus, actor_name: 'أدمن' });
    notifyCustomer(order?.customer_id, orderId, newStatus);
    toast.success('تم تحديث الحالة');
    loadOrders();
  };

  const handleCancelOrder = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' as OrderStatusEnum, designer_id: null })
      .eq('id', orderId);
    if (error) { toast.error('فشل إلغاء الطلب'); return; }
    logActivity('cancel_order', null, { order_id: orderId, actor_name: 'أدمن' });
    toast.success('تم إلغاء الطلب');
    loadOrders();
  };

  const handleAssignDesigner = async (orderId: string, designerId: string) => {
    const updateData: { designer_id: string; status?: OrderStatusEnum } = { designer_id: designerId };
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
    const designer = designers.find(d => d.user_id === designerId);
    logActivity('assign_designer', designerId, { order_id: orderId, designer_name: designer?.display_name || 'مصمم', actor_name: 'أدمن' });
    toast.success('تم تعيين المصمم');
    loadOrders();
  };

  const handleToggleRole = async (userId: string, role: string, hasRole: boolean) => {
    const targetUser = allUsers.find(u => u.user_id === userId);
    // Protect super admins: no one can change another super admin's roles
    if (targetUser?.is_super_admin && userId !== user?.id) {
      toast.error('لا يمكن تغيير صلاحيات سوبر أدمن آخر');
      return;
    }
    // Protect own super admin: can't remove admin role while super admin
    if (targetUser?.is_super_admin && role === 'admin' && hasRole) {
      toast.error('أزل صلاحية السوبر أدمن أولاً قبل إزالة دور الأدمن');
      return;
    }
    // Restrict admin role toggle to super admin only
    if (role === 'admin' && !isSuperAdmin) {
      toast.error('فقط السوبر أدمن يمكنه تعديل دور الأدمن');
      return;
    }
    try {
      if (hasRole) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role as AppRole);
        if (error) throw error;
        logActivity('revoke_role', userId, { role, target_name: targetUser?.display_name || targetUser?.phone || '-', actor_name: 'أدمن' });
        toast.success(`تم إزالة دور ${ROLE_LABELS[role]}`);
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: role as AppRole });
        if (error) {
          if (error.code === '23505') { toast.error('الدور موجود مسبقاً'); return; }
          throw error;
        }
        logActivity('grant_role', userId, { role, target_name: targetUser?.display_name || targetUser?.phone || '-', actor_name: 'أدمن' });
        toast.success(`تم إضافة دور ${ROLE_LABELS[role]}`);
      }
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'فشل تعديل الدور');
    }
  };

  const handleToggleSuperAdmin = async (userId: string, currentlySuper: boolean) => {
    // Only super admins can toggle super admin
    if (!isSuperAdmin) {
      toast.error('فقط السوبر أدمن يمكنه تعديل هذه الصلاحية');
      return;
    }
    // Can't change another super admin - only yourself
    if (currentlySuper && userId !== user?.id) {
      toast.error('لا يمكنك إزالة صلاحية سوبر أدمن من شخص آخر — فقط هو يمكنه ذلك');
      return;
    }
    // Can't grant super admin to non-admin
    const targetUser = allUsers.find(u => u.user_id === userId);
    if (!currentlySuper && !targetUser?.roles.includes('admin')) {
      toast.error('يجب أن يكون المستخدم أدمن أولاً');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_super_admin: !currentlySuper })
        .eq('user_id', userId);
      if (error) throw error;
      logActivity(currentlySuper ? 'revoke_super_admin' : 'grant_super_admin', userId, { target_name: targetUser?.display_name || targetUser?.phone || '-', actor_name: 'أدمن' });
      toast.success(currentlySuper ? 'تم إزالة صلاحية السوبر أدمن' : 'تم ترقية المستخدم إلى سوبر أدمن');
      loadAllUsers();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'فشل تعديل الصلاحية');
    }
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
      logActivity('create_admin', data?.user_id, { target_name: adminForm.display_name.trim() || adminForm.phone.trim(), actor_name: 'أدمن' });
      setAdminDialogOpen(false);
      setAdminForm({ phone: '', display_name: '', password: '' });
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'فشل إنشاء حساب الأدمن');
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
      logActivity('create_designer', data?.user_id, { target_name: designerForm.display_name.trim() || designerForm.phone.trim(), actor_name: 'أدمن' });
      setDesignerDialogOpen(false);
      setDesignerForm({ phone: '', display_name: '', password: '' });
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'فشل إنشاء حساب المصمم');
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
      const deletedUser = allUsers.find(u => u.user_id === userId);
      logActivity('delete_user', userId, { target_name: deletedUser?.display_name || deletedUser?.phone || '-', actor_name: 'أدمن' });
      toast.success('تم حذف حساب المصمم');
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'فشل حذف الحساب');
    }
  };

  // Delete an admin account — super admin only. The server (admin-delete-user) enforces the rules
  // (no self-delete, no deleting a super admin, only a super admin may delete an admin); the UI
  // mirrors them and surfaces the function's Arabic error (hidden by supabase-js's generic wrapper).
  const handleDeleteAdmin = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      });
      if (error) {
        let message = (error as { message?: string })?.message || 'فشل حذف الحساب';
        const ctx = (error as { context?: unknown }).context;
        if (ctx && typeof (ctx as Response).json === 'function') {
          try { const b = await (ctx as Response).json(); if (b?.error) message = b.error; } catch { /* keep */ }
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      const deletedUser = allUsers.find(u => u.user_id === userId);
      logActivity('delete_admin', userId, { target_name: deletedUser?.display_name || deletedUser?.phone || '-', actor_name: 'سوبر أدمن' });
      toast.success('تم حذف حساب الأدمن');
      Promise.all([loadAllUsers(), loadDesigners()]);
    } catch (e: unknown) {
      toast.error((e as Error).message || 'فشل حذف الحساب');
    }
  };

  const handleExportPrintedOrders = () => {
    const printedOrders = orders.filter(o => o.status === 'printed' || o.status === 'delivered');
    if (printedOrders.length === 0) {
      toast.error('لا توجد طلبات مطبوعة للتصدير');
      return;
    }

    const exportData = printedOrders.map((o, i) => {
      const details = (o.details || {}) as OrderDetailsJson;
      return {
        '#': i + 1,
        'اسم الزبون': o.profiles?.display_name || details.name || '-',
        'رقم الهاتف': o.profiles?.phone || details.phone || '-',
        'العنوان': details.address || '-',
        'البريد الإلكتروني': details.email || '-',
        'نوع الخدمة': SERVICE_LABELS[o.templates?.service_type ?? ''] || '-',
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
          const val = String((row as Record<string, unknown>)[h] ?? '').replace(/"/g, '""');
          return `"${val}"`;
        }).join(',')
      ),
    ];
    const bom = '﻿';
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
  const designerWorkload: DesignerWorkloadItem[] = designers.map(d => ({
    ...d,
    activeOrders: orders.filter(o => o.designer_id === d.user_id && !['approved', 'print_ready', 'printed', 'delivered', 'draft', 'cancelled'].includes(o.status)).length,
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
          <div className="overflow-x-auto scrollbar-hide mb-6 -mx-1 px-1">
            <TabsList className="inline-flex w-auto min-w-full gap-1 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="orders" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <ClipboardList className="w-4 h-4 flex-shrink-0" />
                الطلبات
              </TabsTrigger>
              <TabsTrigger value="accounts" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <BarChart3 className="w-4 h-4 flex-shrink-0" />
                الحسابات
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <LayoutGrid className="w-4 h-4 flex-shrink-0" />
                القوالب
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <Package className="w-4 h-4 flex-shrink-0" />
                الخدمات
              </TabsTrigger>
              <TabsTrigger value="ai-designs" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                تصاميم AI
              </TabsTrigger>
              <TabsTrigger value="designers" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <Palette className="w-4 h-4 flex-shrink-0" />
                المصممين
              </TabsTrigger>
              <TabsTrigger value="customers" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <User className="w-4 h-4 flex-shrink-0" />
                الزبائن
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <Users className="w-4 h-4 flex-shrink-0" />
                المستخدمين
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="admins" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  الأدمنز
                </TabsTrigger>
              )}
              <TabsTrigger value="resellers" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <Store className="w-4 h-4 flex-shrink-0" />
                المطابع
              </TabsTrigger>
              <TabsTrigger value="discounts" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <Percent className="w-4 h-4 flex-shrink-0" />
                الخصومات
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap rounded-lg">
                <Activity className="w-4 h-4 flex-shrink-0" />
                السجل
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ORDERS TAB */}
          <TabsContent value="orders">
            <AdminOrdersTab
              orders={orders}
              filteredOrders={filteredOrders}
              designers={designers}
              designerWorkload={designerWorkload}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              serviceFilter={serviceFilter}
              setServiceFilter={setServiceFilter}
              designerFilter={designerFilter}
              setDesignerFilter={setDesignerFilter}
              sortBy={sortBy}
              setSortBy={setSortBy}
              quickFilter={quickFilter}
              setQuickFilter={setQuickFilter}
              openOrders={openOrders}
              setOpenOrders={setOpenOrders}
              SERVICE_LABELS={SERVICE_LABELS}
              handleStatusChange={handleStatusChange}
              handleAssignDesigner={handleAssignDesigner}
              handleCancelOrder={handleCancelOrder}
              downloadDesignFromBucket={downloadDesignFromBucket}
              downloadDesignFromUrl={downloadDesignFromUrl}
            />
          </TabsContent>

          {/* ACCOUNTS TAB */}
          <TabsContent value="accounts">
            <AdminAccounts />
          </TabsContent>

          {/* TEMPLATES TAB */}
          <TabsContent value="templates">
            <AdminTemplates />
          </TabsContent>

          {/* SERVICES & SPECIALIZATIONS TAB (AI-design catalog now lives inside each sub-service) */}
          <TabsContent value="services">
            <AdminServicesSpecs />
            <AdminLocationsSync />
            <div className="mt-10 pt-8 border-t border-border/60">
              <AdminAiUsage />
            </div>
          </TabsContent>

          {/* AI DESIGNS TAB — gallery of every AI design customers generated */}
          <TabsContent value="ai-designs">
            <AdminAiDesigns />
          </TabsContent>

          {/* DESIGNERS TAB */}
          <TabsContent value="designers">
            <AdminDesignersTab
              designerWorkload={designerWorkload}
              orders={orders}
              SERVICE_LABELS={SERVICE_LABELS}
              totalOrders={totalOrders}
              handleToggleDesignerActive={handleToggleDesignerActive}
            />
          </TabsContent>

          {/* CUSTOMERS TAB */}
          <TabsContent value="customers">
            <AdminCustomers />
          </TabsContent>

          {/* USERS TAB - Designers management only */}
          <TabsContent value="users">
            <AdminUsersTab
              allUsers={allUsers}
              isSuperAdmin={isSuperAdmin}
              handleToggleRole={handleToggleRole}
              handleDeleteDesigner={handleDeleteDesigner}
              designerDialogOpen={designerDialogOpen}
              setDesignerDialogOpen={setDesignerDialogOpen}
              designerForm={designerForm}
              setDesignerForm={setDesignerForm}
              handleCreateDesigner={handleCreateDesigner}
              creatingDesigner={creatingDesigner}
            />
          </TabsContent>

          {/* ADMINS TAB - Super Admin Only */}
          {isSuperAdmin && (
            <TabsContent value="admins">
              <AdminAdminsTab
                allUsers={allUsers}
                isSuperAdmin={isSuperAdmin}
                currentUserId={user?.id}
                handleToggleSuperAdmin={handleToggleSuperAdmin}
                handleToggleRole={handleToggleRole}
                handleDeleteAdmin={handleDeleteAdmin}
                adminDialogOpen={adminDialogOpen}
                setAdminDialogOpen={setAdminDialogOpen}
                adminForm={adminForm}
                setAdminForm={setAdminForm}
                handleCreateAdmin={handleCreateAdmin}
                creatingAdmin={creatingAdmin}
              />
            </TabsContent>
          )}

          {/* RESELLERS TAB */}
          <TabsContent value="resellers">
            <AdminResellers />
          </TabsContent>

          {/* DISCOUNTS TAB */}
          <TabsContent value="discounts">
            <AdminDiscounts />
          </TabsContent>

          {/* ACTIVITY LOG TAB */}
          <TabsContent value="activity">
            <AdminActivityLog />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
