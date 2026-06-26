import { useEffect, useState, useCallback } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Crown, ShieldCheck, Palette, Trash2,
  UserPlus, UserMinus, ToggleLeft, Clock, Activity
} from 'lucide-react';

interface ActivityLogDetails {
  actor_name?: string;
  target_name?: string;
  role?: string;
  new_status?: string;
  order_id?: string;
  designer_name?: string;
}

interface ActivityLog {
  id: string;
  actor_id: string;
  action: string;
  target_user_id: string | null;
  details: ActivityLogDetails;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  grant_super_admin: { label: 'منح سوبر أدمن', icon: Crown, color: 'text-amber-500' },
  revoke_super_admin: { label: 'إزالة سوبر أدمن', icon: Crown, color: 'text-destructive' },
  grant_role: { label: 'منح دور', icon: UserPlus, color: 'text-success' },
  revoke_role: { label: 'إزالة دور', icon: UserMinus, color: 'text-destructive' },
  create_admin: { label: 'إنشاء حساب أدمن', icon: ShieldCheck, color: 'text-primary' },
  create_designer: { label: 'إنشاء حساب مصمم', icon: Palette, color: 'text-secondary' },
  delete_user: { label: 'حذف حساب', icon: Trash2, color: 'text-destructive' },
  toggle_designer_active: { label: 'تغيير حالة مصمم', icon: ToggleLeft, color: 'text-cmyk-cyan' },
  assign_designer: { label: 'تعيين مصمم', icon: Palette, color: 'text-primary' },
  change_order_status: { label: 'تغيير حالة طلب', icon: Activity, color: 'text-cmyk-yellow' },
  cancel_order: { label: 'إلغاء طلب', icon: Trash2, color: 'text-destructive' },
};

const ROLE_LABELS: Record<string, string> = { customer: 'زبون', designer: 'مصمم', admin: 'أدمن' };

const AdminActivityLog = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs((data as ActivityLog[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  useEffect(() => {
    const channel = supabase
      .channel('activity-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => loadLogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadLogs]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    if (diffHr < 24) return `منذ ${diffHr} ساعة`;
    if (diffDay < 7) return `منذ ${diffDay} يوم`;
    return d.toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const renderDetails = (log: ActivityLog) => {
    const d = log.details || {};
    const parts: string[] = [];

    if (d.actor_name) parts.push(`بواسطة: ${d.actor_name}`);
    if (d.target_name) parts.push(`المستهدف: ${d.target_name}`);
    if (d.role) parts.push(`الدور: ${ROLE_LABELS[d.role] || d.role}`);
    if (d.new_status) parts.push(`الحالة: ${d.new_status}`);
    if (d.order_id) parts.push(`الطلب: #${d.order_id.slice(0, 8)}`);
    if (d.designer_name) parts.push(`المصمم: ${d.designer_name}`);

    return parts.join(' • ');
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">جاري تحميل السجل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            سجل النشاطات
          </h3>
          <p className="text-sm text-muted-foreground">آخر {logs.length} عملية مسجلة</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">لا توجد نشاطات مسجلة بعد</p>
          <p className="text-muted-foreground text-sm mt-1">ستظهر هنا جميع العمليات الإدارية</p>
        </div>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-2 pr-3">
            <AnimatePresence>
              {logs.map((log, i) => {
                const config = ACTION_CONFIG[log.action] || { label: log.action, icon: Activity, color: 'text-muted-foreground' };
                const Icon = config.icon;
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className="bg-card rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/50`}>
                        <Icon className={`w-4.5 h-4.5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[11px] ${config.color} border-current/20`}>
                            {config.label}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(log.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {renderDetails(log)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default AdminActivityLog;
