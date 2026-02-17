import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { SERVICE_LABELS, STATUS_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Package, Users, BarChart3, ClipboardList,
  UserPlus, Trash2, Eye, Printer, Truck, CheckCircle,
  ArrowLeftRight, ShieldCheck, Palette, User
} from 'lucide-react';

const ORDER_STATUSES: OrderStatus[] = [
  'draft', 'submitted', 'assigned', 'design_uploaded',
  'waiting_approval', 'approved', 'print_ready', 'printed', 'delivered'
];

const AdminPanel = () => {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [designers, setDesigners] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, templates(name, service_type)')
      .order('created_at', { ascending: false });
    setOrders(data || []);
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

  useEffect(() => {
    Promise.all([loadOrders(), loadDesigners(), loadAllUsers()]).then(() => setLoading(false));
  }, [loadOrders, loadDesigners, loadAllUsers]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus as any })
      .eq('id', orderId);
    if (error) { toast.error('فشل تحديث الحالة'); return; }
    toast.success('تم تحديث الحالة');
    loadOrders();
  };

  const handleAddRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: newRole as any });
    if (error) {
      if (error.code === '23505') toast.error('الدور موجود مسبقاً');
      else toast.error('فشل إضافة الدور');
      return;
    }
    toast.success('تمت إضافة الدور');
    Promise.all([loadAllUsers(), loadDesigners()]);
  };

  const handleRemoveRole = async (userId: string, roleToRemove: string) => {
    if (roleToRemove === 'customer') { toast.error('لا يمكن إزالة دور الزبون'); return; }
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', roleToRemove as any);
    if (error) { toast.error('فشل إزالة الدور'); return; }
    toast.success('تمت إزالة الدور');
    Promise.all([loadAllUsers(), loadDesigners()]);
  };

  if (role !== 'admin') {
    return <div className="py-20 text-center"><p className="text-destructive text-lg">ليس لديك صلاحية الوصول</p></div>;
  }

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  // Stats
  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => ['submitted', 'draft'].includes(o.status)).length;
  const inProgressOrders = orders.filter(o => ['assigned', 'design_uploaded', 'waiting_approval'].includes(o.status)).length;
  const completedOrders = orders.filter(o => ['approved', 'print_ready', 'printed', 'delivered'].includes(o.status)).length;

  return (
    <div className="py-8">
      <div className="container max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
            لوحة الإدارة
          </h1>
          <p className="text-muted-foreground">إدارة شاملة للطلبات والمستخدمين</p>
        </div>

        <Tabs defaultValue="orders" dir="rtl">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">الطلبات</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">الإحصائيات</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">المستخدمين</span>
            </TabsTrigger>
          </TabsList>

          {/* ORDERS TAB */}
          <TabsContent value="orders">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="فلتر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات ({orders.length})</SelectItem>
                  {ORDER_STATUSES.map(s => {
                    const count = orders.filter(o => o.status === s).length;
                    return (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filteredOrders.length} طلب</span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">لا توجد طلبات</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order, i) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card rounded-xl p-5 border border-border shadow-sm"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Header */}
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-foreground">{order.templates?.name || '-'}</h3>
                            <StatusBadge status={order.status as OrderStatus} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>الزبون: {order.customer_name || '-'}</span>
                            <span>الخدمة: {SERVICE_LABELS[order.templates?.service_type as ServiceType] || ''}</span>
                            <span dir="ltr">هاتف: {order.customer_phone || '-'}</span>
                            <span>{new Date(order.created_at).toLocaleDateString('ar')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      {order.details && (
                        <div className="bg-muted/50 rounded-lg p-3 text-sm">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Object.entries(order.details as Record<string, any>).filter(([_, val]) => typeof val === 'string').map(([key, val]) => 
                              val ? (
                                <div key={key}>
                                  <span className="text-muted-foreground">{key === 'name' ? 'الاسم' : key === 'phone' ? 'الهاتف' : key === 'job_title' ? 'المسمى' : key === 'address' ? 'العنوان' : key === 'email' ? 'البريد' : key === 'notes' ? 'ملاحظات' : key}: </span>
                                  <span className="text-foreground">{val}</span>
                                </div>
                              ) : null
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Auto-assigned Designer (read-only) */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">المصمم:</span>
                          <Badge variant={order.designer_id ? 'secondary' : 'outline'} className="text-sm">
                            <Palette className="w-3 h-3 ml-1" />
                            {order.designer_id
                              ? (designers.find(d => d.user_id === order.designer_id)?.display_name || 'مصمم')
                              : 'تعيين تلقائي عند الإرسال'}
                          </Badge>
                        </div>

                        {/* Change Status */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">الحالة:</span>
                          <Select
                            value={order.status}
                            onValueChange={(val) => handleStatusChange(order.id, val)}
                          >
                            <SelectTrigger className="w-40 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* STATS TAB */}
          <TabsContent value="stats">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">إجمالي الطلبات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{totalOrders}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">بانتظار التعيين</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{pendingOrders}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">قيد التنفيذ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent-foreground">{inProgressOrders}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">مكتملة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">{completedOrders}</div>
                </CardContent>
              </Card>
            </div>

            {/* Orders by service */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الطلبات حسب الخدمة</CardTitle>
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

            {/* Designers stats */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">المصممين</CardTitle>
              </CardHeader>
              <CardContent>
                {designers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">لا يوجد مصممين</p>
                ) : (
                  <div className="space-y-3">
                    {designers.map(d => {
                      const assignedCount = orders.filter(o => o.designer_id === d.user_id).length;
                      return (
                        <div key={d.user_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Palette className="w-4 h-4 text-primary" />
                            <span className="font-medium text-foreground">{d.display_name || d.phone || 'مصمم'}</span>
                          </div>
                          <Badge variant="secondary">{assignedCount} طلب</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users">
            <div className="space-y-4">
              {allUsers.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-lg">لا يوجد مستخدمين</p>
                </div>
              ) : (
                allUsers.map((u, i) => (
                  <motion.div
                    key={u.user_id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card rounded-xl p-5 border border-border shadow-sm"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {u.display_name || u.phone || 'مستخدم'}
                        </h3>
                        {u.phone && <p className="text-sm text-muted-foreground mt-1" dir="ltr">{u.phone}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          {u.roles.map((r: string) => (
                            <Badge
                              key={r}
                              variant={r === 'admin' ? 'default' : r === 'designer' ? 'secondary' : 'outline'}
                              className="flex items-center gap-1"
                            >
                              {r === 'admin' ? <ShieldCheck className="w-3 h-3" /> : r === 'designer' ? <Palette className="w-3 h-3" /> : <User className="w-3 h-3" />}
                              {r === 'admin' ? 'أدمن' : r === 'designer' ? 'مصمم' : 'زبون'}
                              {r !== 'customer' && (
                                <button
                                  onClick={() => handleRemoveRole(u.user_id, r)}
                                  className="mr-1 hover:text-destructive"
                                  title="إزالة الدور"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!u.roles.includes('designer') && (
                          <Button size="sm" variant="outline" onClick={() => handleAddRole(u.user_id, 'designer')}>
                            <Palette className="w-4 h-4 ml-1" />
                            مصمم
                          </Button>
                        )}
                        {!u.roles.includes('admin') && (
                          <Button size="sm" variant="outline" onClick={() => handleAddRole(u.user_id, 'admin')}>
                            <ShieldCheck className="w-4 h-4 ml-1" />
                            أدمن
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPanel;
