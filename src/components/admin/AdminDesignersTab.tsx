import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Palette, WifiOff } from 'lucide-react';
import type { AdminOrder, DesignerWorkloadItem } from './adminTypes';

interface Props {
  designerWorkload: DesignerWorkloadItem[];
  orders: AdminOrder[];
  SERVICE_LABELS: Record<string, string>;
  totalOrders: number;
  handleToggleDesignerActive: (userId: string, currentActive: boolean) => void;
}

const AdminDesignersTab = ({ designerWorkload, orders, SERVICE_LABELS, totalOrders, handleToggleDesignerActive }: Props) => {
  return (
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
            const isActive = d.is_active !== false;
            const lastSeen = d.last_seen ? new Date(d.last_seen) : null;
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
  );
};

export default AdminDesignersTab;
