import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, Send, FileText, Image, Trash2, CheckCircle2, Clock, RefreshCw, Eye, MessageSquare, AlertTriangle, Copy, ExternalLink } from 'lucide-react';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { OrderStatus } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { getDesignSignedUrl } from '@/lib/storage';
import { getUserFriendlyError } from '@/lib/errors';

interface DesignVersion {
  id: string;
  version: number;
  file_url: string | null;
  approved: boolean | null;
  uploaded_at: string;
}

const DesignerOrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [designs, setDesigns] = useState<DesignVersion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sendingApproval, setSendingApproval] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOrder = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, templates(name, service_type, preview_url)')
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
    setDesigns((data as DesignVersion[]) || []);
  }, [orderId]);

  useEffect(() => {
    loadOrder();
    loadDesigns();
  }, [loadOrder, loadDesigns]);

  // Realtime: listen for order changes (e.g. customer requests revision)
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        const newStatus = payload.new?.status;
        const oldStatus = payload.old?.status;
        if (newStatus === 'assigned' && oldStatus !== 'assigned') {
          toast({ title: '📝 العميل طلب تعديل على التصميم' });
        }
        loadOrder();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'designs',
        filter: `order_id=eq.${orderId}`,
      }, () => {
        loadDesigns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, loadOrder, loadDesigns]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orderId) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 10MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const nextVersion = designs.length > 0 ? designs[0].version + 1 : 1;
      const ext = file.name.split('.').pop();
      const filePath = `${orderId}/v${nextVersion}.${ext}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('designs')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Store the storage path (not a URL) since bucket is private
      const { error: insertError } = await supabase
        .from('designs')
        .insert({
          order_id: orderId,
          version: nextVersion,
          file_url: filePath,
        });

      if (insertError) throw insertError;

      // Update order status
      await supabase.from('orders').update({ status: 'design_uploaded' as any }).eq('id', orderId);

      toast({ title: 'تم رفع التصميم بنجاح', description: `الإصدار ${nextVersion}` });
      loadOrder();
      loadDesigns();
    } catch (err: any) {
      toast({ title: 'فشل رفع الملف', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendForApproval = async () => {
    if (!orderId) return;
    setSendingApproval(true);
    await supabase.from('orders').update({ status: 'waiting_approval' as any }).eq('id', orderId);
    toast({ title: 'تم إرسال التصميم للعميل للموافقة' });
    loadOrder();
    setSendingApproval(false);
  };

  const handleViewDesign = async (filePath: string) => {
    const url = await getDesignSignedUrl(filePath);
    if (url) window.open(url, '_blank');
    else toast({ title: 'فشل فتح الملف', variant: 'destructive' });
  };

  const handleDeleteDesign = async (design: DesignVersion) => {
    if (!orderId || !design.file_url) return;
    try {
      // file_url now stores the path directly
      await supabase.storage.from('designs').remove([design.file_url]);
      await supabase.from('designs').delete().eq('id', design.id);
      toast({ title: 'تم حذف الإصدار' });
      loadDesigns();

      // If no designs left, revert status
      const remaining = designs.filter(d => d.id !== design.id);
      if (remaining.length === 0) {
        await supabase.from('orders').update({ status: 'assigned' as any }).eq('id', orderId);
        loadOrder();
      }
    } catch (err: any) {
      toast({ title: 'فشل الحذف', description: getUserFriendlyError(err), variant: 'destructive' });
    }
  };

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;
  if (!order) return <div className="py-20 text-center"><p className="text-muted-foreground text-lg">لم يتم العثور على الطلب</p></div>;

  const details = (order.details || {}) as Record<string, any>;
  const revisions: { note: string; date: string; version: number }[] = details.revisions || [];
  const canUpload = ['assigned', 'design_uploaded'].includes(order.status);
  const canSendApproval = ['assigned', 'design_uploaded'].includes(order.status) && designs.length > 0;
  const latestDesign = designs[0];

  // Build timeline dynamically — revision step appears only when there are revisions
  const hasRevision = revisions.length > 0;

  // Map current order status to a timeline step index
  const getTimelineStep = () => {
    if (['print_ready', 'printed', 'delivered'].includes(order.status)) return hasRevision ? 3 : 2;
    if (order.status === 'approved') return hasRevision ? 3 : 2;
    if (order.status === 'waiting_approval') return hasRevision ? 2 : 1;
    // assigned after revision = currently at revision step
    if (order.status === 'assigned' && hasRevision) return 2;
    if (['design_uploaded', 'assigned'].includes(order.status)) return 1;
    return 0;
  };

  type StepDef = { key: string; label: string; icon: typeof Clock; isRevision?: boolean };

  const baseSteps: StepDef[] = [
    { key: 'assigned',         label: 'تم تعيين مصمم',      icon: Clock },
    { key: 'design_sent',      label: 'تم إرسال التصميم',   icon: Send },
  ];
  if (hasRevision) {
    baseSteps.push({ key: 'revision', label: 'طلب تعديل', icon: MessageSquare, isRevision: true });
  }
  baseSteps.push({ key: 'approved', label: 'تمت الموافقة', icon: CheckCircle2 });

  const currentStepIndex = getTimelineStep();

  return (
    <div className="py-8">
      <div className="container max-w-3xl">
        <Link to="/designer/orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowRight className="w-4 h-4" />
          العودة للطلبات
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">تفاصيل الطلب</h1>
              <p className="text-muted-foreground text-sm mt-1">{order.templates?.name} • {order.customer_name}</p>
            </div>
            <StatusBadge status={order.status as OrderStatus} />
          </div>

          {/* Progress Steps */}
          <div className="bg-card rounded-xl p-5 border border-border mb-6">
            <div className="flex items-center justify-between relative">
              {/* Progress line */}
              <div className="absolute top-5 right-5 left-5 h-0.5 bg-border z-0" />
              <div
                className="absolute top-5 right-5 h-0.5 bg-primary z-0 transition-all"
                style={{ width: `${Math.max(0, currentStepIndex) / (baseSteps.length - 1) * 100}%` }}
              />
              {baseSteps.map((step, i) => {
                const isActive = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCurrent ? 'bg-primary border-primary text-primary-foreground scale-110' :
                      isActive ? 'bg-primary/20 border-primary text-primary' :
                      'bg-card border-border text-muted-foreground'
                    }`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className={`text-xs mt-2 text-center ${isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Template Info with copyable ID */}
          <div className="bg-card rounded-xl border border-border mb-6 overflow-hidden">
            {order.templates?.preview_url ? (
              <img src={order.templates.preview_url} alt="القالب" className="w-full max-h-64 object-contain bg-muted/20" />
            ) : (
              <div className="h-32 bg-muted/20 flex items-center justify-center">
                <Image className="w-10 h-10 text-muted-foreground/30" />
              </div>
            )}
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">رقم القالب</p>
                <p className="font-mono font-bold text-primary text-xl tracking-widest">
                  {order.template_id ? order.template_id.slice(0, 8).toUpperCase() : '—'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (order.template_id) {
                    navigator.clipboard.writeText(order.template_id.slice(0, 8).toUpperCase());
                    toast({ title: 'تم نسخ رقم القالب' });
                  }
                }}
              >
                <Copy className="w-4 h-4" />
                نسخ الرقم
              </Button>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-card rounded-xl p-6 border border-border mb-6">
            {/* Ready Design Badge */}
            {details.order_type === 'ready_design' && (
              <div className="flex items-center gap-2 bg-cmyk-cyan/10 text-cmyk-cyan border border-cmyk-cyan/20 rounded-xl px-4 py-2.5 mb-4 text-sm font-semibold">
                <Upload className="w-4 h-4" />
                تصميم جاهز للمراجعة — نوع الطباعة: {details.service_type || '—'}
              </div>
            )}

            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {details.order_type === 'ready_design' ? 'ملف التصميم الجاهز' : 'تفاصيل التصميم من الزبون'}
            </h3>

            {/* Ready design: show the file prominently */}
            {details.order_type === 'ready_design' && Array.isArray(details.attachment_urls) && details.attachment_urls.length > 0 ? (
              <div className="space-y-3">
                {(details.attachment_urls as string[]).map((url: string, i: number) => {
                  const ext = url.split('.').pop()?.toLowerCase() || '';
                  const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl overflow-hidden border border-border/60 bg-muted/20 group hover:border-primary/40 transition-colors"
                    >
                      {isImage ? (
                        <div className="relative">
                          <img src={url} alt="" className="w-full max-h-80 object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ExternalLink className="w-8 h-8 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-sm">{ext.toUpperCase()} — ملف التصميم</p>
                            <p className="text-muted-foreground text-xs">اضغط لفتح الملف</p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground mr-auto group-hover:text-primary transition-colors" />
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            ) : details.details ? (
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-xl p-4 border border-border/50">
                {details.details}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">لا توجد تفاصيل</p>
            )}

            {/* Non-ready-design attachments */}
            {details.order_type !== 'ready_design' && Array.isArray(details.attachment_urls) && details.attachment_urls.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" />
                  صور / لوغوهات الزبون ({details.attachment_urls.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(details.attachment_urls as string[]).map((url: string, i: number) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative rounded-xl overflow-hidden border border-border/60 aspect-square bg-muted/20 group hover:border-primary/40 transition-colors"
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-white" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Section */}
          <div className="bg-card rounded-xl p-6 border border-border mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">التصميمات</h3>
              {designs.length > 0 && (
                <span className="text-xs text-muted-foreground">{designs.length} إصدار</span>
              )}
            </div>

            {/* Upload Area */}
            {canUpload && (
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    uploading
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-primary/5'
                  }`}
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
                      <p className="text-foreground font-medium">جاري الرفع...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-foreground font-medium">
                        {designs.length > 0 ? 'رفع إصدار جديد' : 'اضغط لرفع ملف التصميم'}
                      </p>
                      <p className="text-muted-foreground text-sm mt-1">PDF, PNG, JPG, WEBP — حتى 10MB</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Design Versions List */}
            {designs.length > 0 && (
              <div className="space-y-3">
                {designs.map((design, i) => (
                  <div
                    key={design.id}
                    className={`rounded-lg p-4 flex items-center justify-between gap-3 ${
                      i === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border border-border'
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
                          {new Date(design.uploaded_at).toLocaleDateString('ar')} — {new Date(design.uploaded_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {design.approved && (
                        <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> معتمد
                        </span>
                      )}
                      {design.file_url && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => handleViewDesign(design.file_url!)}>
                          <Eye className="w-3 h-3 ml-1" /> عرض
                        </Button>
                      )}
                      {canUpload && !design.approved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDeleteDesign(design)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Send for Approval */}
            {canSendApproval && (
              <Button
                onClick={handleSendForApproval}
                disabled={sendingApproval}
                size="lg"
                className="w-full mt-4 bg-accent hover:bg-accent/90 text-accent-foreground text-lg py-6 rounded-xl"
              >
                <Send className="w-5 h-5 ml-2" />
                {sendingApproval ? 'جاري الإرسال...' : 'إرسال للعميل للموافقة'}
              </Button>
            )}

            {order.status === 'waiting_approval' && (
              <div className="mt-4 bg-accent/10 rounded-lg p-4 text-center">
                <RefreshCw className="w-6 h-6 text-accent-foreground mx-auto mb-2" />
                <p className="font-medium text-foreground">بانتظار موافقة العميل</p>
                <p className="text-muted-foreground text-sm mt-1">سيتم إخطارك عند ردّ العميل</p>
              </div>
            )}

            {order.status === 'approved' && (
              <div className="mt-4 bg-success/10 rounded-lg p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                <p className="font-medium text-foreground">تمت موافقة العميل على التصميم!</p>
              </div>
            )}
          </div>

          {/* Revision Notes from Customer */}
          {revisions.length > 0 && (
            <div className="bg-card rounded-xl p-6 border border-border mb-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="w-5 h-5 text-destructive" />
                <h3 className="font-bold text-foreground">ملاحظات العميل</h3>
              </div>

              {/* Latest revision highlighted */}
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-bold text-destructive">آخر طلب تعديل</span>
                  <span className="text-xs text-muted-foreground mr-auto">
                    الإصدار {revisions[revisions.length - 1].version} — {new Date(revisions[revisions.length - 1].date).toLocaleDateString('ar')}
                  </span>
                </div>
                <p className="text-foreground">{revisions[revisions.length - 1].note}</p>
              </div>

              {/* Older revisions */}
              {revisions.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">تعديلات سابقة:</p>
                  {revisions.slice(0, -1).reverse().map((rev, i) => (
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
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DesignerOrderDetails;
