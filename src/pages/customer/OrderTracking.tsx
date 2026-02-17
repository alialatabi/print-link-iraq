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
    // Auto-load preview for the latest design
    if (designs.length > 0 && designs[0].file_url) {
      const url = await getDesignSignedUrl(designs[0].file_url);
      if (url) setPreviewUrl(url);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
    loadDesigns();
  }, [loadOrder, loadDesigns]);

  // Realtime: listen for new designs uploaded by designer
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
    // Mark latest design as approved
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
    // Store revision note in order details and revert to assigned
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

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;
  if (!order) return <div className="py-20 text-center"><p className="text-muted-foreground text-lg">لم يتم العثور على الطلب</p></div>;

  const currentStepIndex = STEPS.findIndex(s => s.status === order.status);
  const details = (order.details || {}) as Record<string, any>;
  const revisions = details.revisions || [];
  const latestDesign = designs[0];
  const showDesignReview = ['waiting_approval', 'design_uploaded'].includes(order.status) || designs.length > 0;

  return (
    <div className="py-8">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">تتبع الطلب</h1>
              <p className="text-muted-foreground text-sm">رقم الطلب: {order.id?.slice(0, 8)}...</p>
            </div>
            <StatusBadge status={order.status as OrderStatus} />
          </div>

          {/* Order Info */}
          <div className="bg-card rounded-xl p-6 border border-border mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">القالب:</span>
                <p className="font-semibold text-foreground">{order.templates?.name || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">الاسم:</span>
                <p className="font-semibold text-foreground">{order.customer_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">الهاتف:</span>
                <p className="font-semibold text-foreground" dir="ltr">{order.customer_phone}</p>
              </div>
              <div>
                <span className="text-muted-foreground">التاريخ:</span>
                <p className="font-semibold text-foreground">{new Date(order.created_at).toLocaleDateString('ar')}</p>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="bg-card rounded-xl p-6 border border-border mb-6">
            <h3 className="font-bold text-foreground mb-6">مراحل الطلب</h3>
            <div className="space-y-4">
              {STEPS.map((step, i) => {
                const isComplete = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.status} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isComplete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                    } ${isCurrent ? 'ring-2 ring-success ring-offset-2' : ''}`}>
                      <step.icon className="w-5 h-5" />
                    </div>
                    <p className={`font-medium flex-1 ${isComplete ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    {isComplete && <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Design Review Section */}
          {showDesignReview && (
            <div className="bg-card rounded-xl p-6 border border-border mb-6">
              <h3 className="font-bold text-foreground mb-4">التصميم</h3>

              {/* Inline Preview */}
              {previewUrl && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
                  <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
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

              {/* Design versions */}
              {designs.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {designs.map((design, i) => {
                    const isSelected = previewUrl !== null && i === 0; // simplified
                    return (
                      <div
                        key={design.id}
                        className={`rounded-lg p-4 flex items-center justify-between gap-3 ${
                          i === 0
                            ? 'bg-primary/5 border border-primary/20'
                            : 'bg-muted/50 border border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className={`w-5 h-5 ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              الإصدار {design.version}
                              {i === 0 && <span className="text-primary text-xs mr-2">(الأحدث)</span>}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {new Date(design.uploaded_at).toLocaleDateString('ar')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {design.approved && (
                            <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> معتمد
                            </span>
                          )}
                          {design.file_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs rounded-lg"
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
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p>المصمم يعمل على تصميمك...</p>
                </div>
              )}

              {/* Approval / Revision Actions */}
              {order.status === 'waiting_approval' && (
                <div className="space-y-3 mt-4">
                  <Button
                    onClick={handleApprove}
                    disabled={submitting}
                    size="lg"
                    className="w-full bg-success hover:bg-success/90 text-success-foreground text-lg py-6 rounded-xl"
                  >
                    <ThumbsUp className="w-5 h-5 ml-2" />
                    {submitting ? 'جاري الإرسال...' : 'الموافقة على التصميم'}
                  </Button>

                  {!showRevisionForm ? (
                    <Button
                      onClick={() => setShowRevisionForm(true)}
                      variant="outline"
                      size="lg"
                      className="w-full text-lg py-6 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
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
                        className="min-h-[100px] rounded-xl"
                        dir="rtl"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleRequestRevision}
                          disabled={submitting || !revisionNote.trim()}
                          className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl"
                        >
                          <MessageSquare className="w-4 h-4 ml-1" />
                          {submitting ? 'جاري الإرسال...' : 'إرسال طلب التعديل'}
                        </Button>
                        <Button
                          onClick={() => { setShowRevisionForm(false); setRevisionNote(''); }}
                          variant="outline"
                          className="rounded-xl"
                        >
                          إلغاء
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {order.status === 'approved' && (
                <div className="bg-success/10 rounded-lg p-4 text-center mt-4">
                  <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
                  <p className="font-medium text-foreground">تمت الموافقة على التصميم!</p>
                  <p className="text-muted-foreground text-sm mt-1">سيتم تحضير طلبك للطباعة</p>
                </div>
              )}
            </div>
          )}

          {/* Revision History */}
          {revisions.length > 0 && (
            <div className="bg-card rounded-xl p-6 border border-border">
              <h3 className="font-bold text-foreground mb-4">سجل التعديلات</h3>
              <div className="space-y-3">
                {revisions.map((rev: any, i: number) => (
                  <div key={i} className="bg-muted/50 rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
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
