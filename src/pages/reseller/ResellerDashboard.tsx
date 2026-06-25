import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import ResellerStageTracker from '@/components/ResellerStageTracker';
import { isCancelled, resellerStageIndex } from '@/lib/resellerStages';
import { Plus, Package, RotateCcw, Calendar, FileText, Store, Loader2, XCircle, Upload, Clock } from 'lucide-react';

const REUPLOAD_ALLOWED = ['png', 'jpg', 'jpeg', 'pdf', 'psd'];

interface ResellerOrderDetails {
  order_type?: string;
  service_type?: string;
  service_label?: string;
  quantity?: number;
  cellophane?: string | null;
  attachment_urls?: string[];
  pricing?: { total?: number };
  review?: { result?: 'approved' | 'rejected' | 'pending'; note?: string | null; at?: string };
}

interface ResellerOrder {
  id: string;
  status: string;
  created_at: string;
  details: ResellerOrderDetails;
}

type Tab = 'current' | 'past';

const formatIQD = (n: number) => `${Math.round(n || 0).toLocaleString('en-US')} د.ع`;

const ResellerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<ResellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('current');
  const [reuploadingId, setReuploadingId] = useState<string | null>(null);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const pendingReuploadRef = useRef<ResellerOrder | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('orders')
      .select('id, status, created_at, details')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
    const rows = (data || []) as unknown as ResellerOrder[];
    setOrders(rows.filter(o => o.details?.order_type === 'reseller'));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Realtime: refresh when one of this reseller's orders changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('reseller-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = (payload.new || payload.old) as { customer_id?: string };
        if (row?.customer_id === user.id) loadOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadOrders]);

  const isPast = (o: ResellerOrder) => o.status === 'delivered' || isCancelled(o.status);
  const filtered = orders.filter(o => (tab === 'past' ? isPast(o) : !isPast(o)));

  const handleReorder = (o: ResellerOrder) => {
    navigate('/reseller/new', {
      state: {
        reorder: {
          serviceId: o.details?.service_type,
          quantity: o.details?.quantity,
          cellophane: o.details?.cellophane || undefined,
          attachmentUrls: o.details?.attachment_urls || [],
        },
      },
    });
  };

  const triggerReupload = (o: ResellerOrder) => {
    pendingReuploadRef.current = o;
    reuploadInputRef.current?.click();
  };

  const handleReuploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const order = pendingReuploadRef.current;
    e.target.value = '';
    if (!file || !order || !user) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!REUPLOAD_ALLOWED.includes(ext)) {
      toast({ title: 'نوع الملف غير مسموح — PNG, JPEG, PDF أو PSD فقط', variant: 'destructive' });
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast({ title: 'الملف كبير جداً — الحد الأقصى 30MB', variant: 'destructive' });
      return;
    }

    setReuploadingId(order.id);
    try {
      const path = `${order.id}/revised_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('order-attachments').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('order-attachments').getPublicUrl(path);
      const newDetails = {
        ...order.details,
        attachment_urls: [...(order.details.attachment_urls || []), publicUrl],
        review: { result: 'pending', at: new Date().toISOString() },
      };
      // Back to the assigned designer for re-review.
      await supabase.from('orders').update({ status: 'assigned', details: newDetails }).eq('id', order.id);
      toast({ title: 'تم رفع التصميم المعدّل — سيُراجعه المصمم' });
      loadOrders();
    } catch (err) {
      toast({ title: 'فشل رفع الملف', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setReuploadingId(null);
      pendingReuploadRef.current = null;
    }
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'current', label: 'الطلبات الحالية', count: orders.filter(o => !isPast(o)).length },
    { key: 'past', label: 'الطلبات السابقة', count: orders.filter(isPast).length },
  ];

  return (
    <div className="py-8">
      <div className="container max-w-3xl">
        {/* Hidden input for re-uploading a corrected design after rejection */}
        <input
          ref={reuploadInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.pdf,.psd"
          className="hidden"
          onChange={handleReuploadFile}
        />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Store className="w-7 h-7 text-primary" />
              لوحة المطبعة
            </h1>
            <p className="text-muted-foreground text-sm">إدارة ومتابعة طلبات الطباعة</p>
          </div>
          <Button onClick={() => navigate('/reseller/new')} className="rounded-xl gap-1.5">
            <Plus className="w-4 h-4" />
            طلب جديد
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-primary-foreground/20' : 'bg-background'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg mb-4">
              {tab === 'current' ? 'لا توجد طلبات حالية' : 'لا توجد طلبات سابقة'}
            </p>
            {tab === 'current' && (
              <Button onClick={() => navigate('/reseller/new')} className="rounded-xl gap-1.5">
                <Plus className="w-4 h-4" />
                ابدأ طلبك الأول
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((o, i) => {
              const d = o.details || {};
              const attachments: string[] = d.attachment_urls || [];
              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-foreground text-sm leading-tight truncate">
                            {d.service_label || 'طلب طباعة'}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            الكمية: {Number(d.quantity || 0).toLocaleString('en-US')}
                            {d.cellophane ? ` · سلوفان ${d.cellophane === 'glossy' ? 'لامع' : 'مطفي'}` : ''}
                            {' · '}<span className="font-mono">#{o.id.slice(0, 8)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="font-extrabold text-primary text-sm">{formatIQD(d.pricing?.total)}</p>
                      </div>
                    </div>

                    {/* 3-stage tracker */}
                    <ResellerStageTracker status={o.status} />

                    {/* Review status */}
                    {d.review?.result === 'rejected' && (
                      <div className="mt-4 bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                        <p className="text-sm font-bold text-destructive flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" />
                          تم رفض التصميم من المصمم
                        </p>
                        {d.review.note && (
                          <p className="text-foreground text-sm mt-2 bg-card rounded-lg p-2.5 border border-border/50 whitespace-pre-wrap">
                            {d.review.note}
                          </p>
                        )}
                        <Button size="sm" className="mt-3 gap-1.5 rounded-lg" disabled={reuploadingId === o.id} onClick={() => triggerReupload(o)}>
                          {reuploadingId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          رفع تصميم معدّل
                        </Button>
                      </div>
                    )}
                    {!isCancelled(o.status) && resellerStageIndex(o.status) === 0 && d.review?.result !== 'rejected' && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 w-fit">
                        <Clock className="w-3.5 h-3.5" />
                        قيد مراجعة المصمم
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(o.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-2">
                        {attachments.length > 0 && (
                          <a
                            href={attachments[0]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            التصميم
                          </a>
                        )}
                        <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg gap-1.5" onClick={() => handleReorder(o)}>
                          <RotateCcw className="w-3.5 h-3.5" />
                          إعادة الطلب
                        </Button>
                      </div>
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

export default ResellerDashboard;
