import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, FileText, Palette, Printer, Truck, Package, Eye, MessageSquare, ThumbsUp, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { OrderStatus } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { getDesignSignedUrl } from '@/lib/storage';

const STEPS = [
  { status: 'submitted', label: 'تم الإرسال', icon: FileText },
  { status: 'assigned', label: 'تم تعيين مصمم', icon: Palette },
  { status: 'design_uploaded', label: 'تم رفع التصميم', icon: Package },
  { status: 'waiting_approval', label: 'بانتظار الموافقة', icon: Clock },
  { status: 'approved', label: 'تمت الموافقة', icon: CheckCircle },
  { status: 'print_ready', label: 'جاهز للطباعة', icon: Printer },
  { status: 'printed', label: 'تمت الطباعة', icon: Printer },
  { status: 'delivered', label: 'تم التسليم', icon: Truck },
];

interface DesignVersion {
  id: string;
  version: number;
  file_url: string | null;
  approved: boolean | null;
  uploaded_at: string;
}

const OrderTracking = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [designs, setDesigns] = useState<DesignVersion[]>([]);
  const [revisionNote, setRevisionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadOrder = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, templates(name)')
      .eq('id', orderId || '')
      .maybeSingle();
    setOrder(data);
    setLoading(false);
  }, [orderId]);

  const loadDesigns = useCallback(async () => {
    const { data } = await supabase
      .from('designs')
      .select('*')
      .eq('order_id', orderId || '')
      .order('version', { ascending: false });
    const designs = (data as DesignVersion[]) || [];
    setDesigns(designs);
    if (designs.length > 0 && designs[0].file_url) {
      const url = await getDesignSignedUrl(designs[0].file_url);
      if (url) setPreviewUrl(url);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
    loadDesigns();
  }, [loadOrder, loadDesigns]);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`tracking-${orderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'designs',
        filter: `order_id=eq.${orderId}`,
      }, () => {
        toast({ title: '🎨 المصمم رفع تصميم جديد!' });
        loadDesigns();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, () => {
        loadOrder();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, loadOrder, loadDesigns]);

  const handleApprove = async () => {
    if (!orderId) return;
    setSubmitting(true);
    if (designs.length > 0) {
      await supabase.from('designs').update({ approved: true }).eq('id', designs[0].id);
    }
    await supabase.from('orders').update({ status: 'approved' as any }).eq('id', orderId);
    toast({ title: 'تمت الموافقة على التصميم ✅' });
    loadOrder();
    loadDesigns();
    setSubmitting(false);
  };

  const handleRequestRevision = async () => {
    if (!orderId || !revisionNote.trim()) return;
    setSubmitting(true);
    const currentDetails = (order?.details || {}) as Record<string, any>;
    const revisions = currentDetails.revisions || [];
    revisions.push({
      note: revisionNote.trim(),
      date: new Date().toISOString(),
      version: designs[0]?.version || 0,
    });
    await supabase.from('orders').update({
      status: 'assigned' as any,
      details: { ...currentDetails, revisions },
    }).eq('id', orderId);
    toast({ title: 'تم إرسال طلب التعديل للمصمم' });
    setRevisionNote('');
    setShowRevisionForm(false);
    loadOrder();
    setSubmitting(false);
  };

  if (loading) return (
    <div className="py-24 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
    </div>
  );
  if (!order) return <div className="py-24 text-center"><p className="text-muted-foreground text-sm">لم يتم العثور على الطلب</p></div>;

  const currentStepIndex = STEPS.findIndex(s => s.status === order.status);
  const details = (order.details || {}) as Record<string, any>;
  const revisions = details.revisions || [];
  const latestDesign = designs[0];
  const showDesignReview = ['waiting_approval', 'design_uploaded'].includes(order.status) || designs.length > 0;

  return (
    <div className="section-spacing-sm">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-10 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">تتبع الطلب</h1>
              <p className="text-muted-foreground text-sm mt-1">رقم الطلب: {order.id?.slice(0, 8)}...</p>
            </div>
            <StatusBadge status={order.status as OrderStatus} />
          </div>

          {/* Order Info */}
          <div className="bg-card rounded-2xl p-6 border border-border/60 shadow-card mb-6">
            <div className="grid grid-cols-2 gap-5 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">القالب</span>
                <p className="font-semibold text-foreground mt-0.5">{order.templates?.name || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">الاسم</span>
                <p className="font-semibold text-foreground mt-0.5">{order.customer_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">الهاتف</span>
                <p className="font-semibold text-foreground mt-0.5" dir="ltr">{order.customer_phone}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">التاريخ</span>
                <p className="font-semibold text-foreground mt-0.5">{new Date(order.created_at).toLocaleDateString('ar')}</p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="bg-card rounded-2xl p-6 border border-border/60 shadow-card mb-6">
            <h3 className="font-bold text-foreground text-sm mb-5">مراحل الطلب</h3>
            <div className="space-y-3">
              {STEPS.map((step, i) => {
                const isComplete = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.status} className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      isComplete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                    } ${isCurrent ? 'ring-2 ring-success/30 ring-offset-2 ring-offset-background' : ''}`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <p className={`font-medium text-sm flex-1 ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    {isComplete && <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Design Review Section */}
          {showDesignReview && (
            <div className="bg-card rounded-2xl p-6 border border-border/60 shadow-card mb-6">
              <h3 className="font-bold text-foreground text-sm mb-5">التصميم</h3>

              {previewUrl && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-5">
                  <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30">
                    <img
                      src={previewUrl}
                      alt="معاينة التصميم"
                      className="w-full max-h-[500px] object-contain"
                      onError={() => {
                        setPreviewUrl(null);
                        toast({ title: 'فشل تحميل المعاينة', variant: 'destructive' });
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {designs.length > 0 ? (
                <div className="space-y-3 mb-5">
                  {designs.map((design, i) => (
                    <div
                      key={design.id}
                      className={`rounded-xl p-4 flex items-center justify-between gap-3 ${
                        i === 0
                          ? 'bg-primary/5 border border-primary/10'
                          : 'bg-muted/40 border border-border/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className={`w-4 h-4 ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <p className="font-medium text-foreground text-sm">
                            الإصدار {design.version}
                            {i === 0 && <span className="text-primary text-[11px] mr-2">(الأحدث)</span>}
                          </p>
                          <p className="text-muted-foreground text-[11px] mt-0.5">
                            {new Date(design.uploaded_at).toLocaleDateString('ar')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {design.approved && (
                          <span className="text-[11px] bg-success/10 text-success px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium">
                            <CheckCircle className="w-3 h-3" /> معتمد
                          </span>
                        )}
                        {design.file_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={loadingPreview}
                            onClick={async () => {
                              setLoadingPreview(true);
                              const url = await getDesignSignedUrl(design.file_url!);
                              if (url) setPreviewUrl(url);
                              else toast({ title: 'فشل تحميل المعاينة', variant: 'destructive' });
                              setLoadingPreview(false);
                            }}
                          >
                            <Eye className="w-3 h-3 ml-1" /> {loadingPreview ? '...' : 'عرض'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <RefreshCw className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm">المصمم يعمل على تصميمك...</p>
                </div>
              )}

              {order.status === 'waiting_approval' && (
                <div className="space-y-3 mt-5">
                  <Button
                    onClick={handleApprove}
                    disabled={submitting}
                    size="lg"
                    className="w-full bg-success hover:bg-success/90 text-success-foreground h-12"
                  >
                    <ThumbsUp className="w-5 h-5 ml-2" />
                    {submitting ? 'جاري الإرسال...' : 'الموافقة على التصميم'}
                  </Button>

                  {!showRevisionForm ? (
                    <Button
                      onClick={() => setShowRevisionForm(true)}
                      variant="outline"
                      size="lg"
                      className="w-full h-12 border-destructive/20 text-destructive hover:bg-destructive/5"
                    >
                      <MessageSquare className="w-5 h-5 ml-2" />
                      طلب تعديل
                    </Button>
                  ) : (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                      <Textarea
                        value={revisionNote}
                        onChange={e => setRevisionNote(e.target.value)}
                        placeholder="اكتب ملاحظاتك للمصمم... مثال: أريد تغيير لون الخلفية"
                        className="min-h-[100px]"
                        dir="rtl"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleRequestRevision}
                          disabled={submitting || !revisionNote.trim()}
                          className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                          <MessageSquare className="w-4 h-4 ml-1" />
                          {submitting ? 'جاري الإرسال...' : 'إرسال طلب التعديل'}
                        </Button>
                        <Button
                          onClick={() => { setShowRevisionForm(false); setRevisionNote(''); }}
                          variant="outline"
                        >
                          إلغاء
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {order.status === 'approved' && (
                <div className="bg-success/8 rounded-xl p-5 text-center mt-5">
                  <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
                  <p className="font-medium text-foreground text-sm">تمت الموافقة على التصميم!</p>
                  <p className="text-muted-foreground text-xs mt-1">سيتم تحضير طلبك للطباعة</p>
                </div>
              )}
            </div>
          )}

          {/* Revision History */}
          {revisions.length > 0 && (
            <div className="bg-card rounded-2xl p-6 border border-border/60 shadow-card">
              <h3 className="font-bold text-foreground text-sm mb-5">سجل التعديلات</h3>
              <div className="space-y-3">
                {revisions.map((rev: any, i: number) => (
                  <div key={i} className="bg-muted/40 rounded-xl p-4 border border-border/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground font-medium">
                        الإصدار {rev.version} — {new Date(rev.date).toLocaleDateString('ar')}
                      </span>
                    </div>
                    <p className="text-foreground text-sm">{rev.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default OrderTracking;
