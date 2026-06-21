import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRight, Upload, Send, FileText, Image, Trash2, CheckCircle2, Clock, RefreshCw, Eye, MessageSquare, AlertTriangle, Copy, ExternalLink, Printer, ChevronDown, ChevronUp, Package, Store, Sparkles, Pencil } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { OrderStatus } from '@/data/mockData';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { getDesignSignedUrl } from '@/lib/storage';
import { getUserFriendlyError } from '@/lib/errors';
import { cn } from '@/lib/utils';

interface DesignVersion {
  id: string;
  version: number;
  file_url: string | null;
  approved: boolean | null;
  uploaded_at: string;
  order_item_id: string | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  template_id: string | null;
  status: OrderStatus;
  details: Record<string, any>;
  templates?: { name: string; service_type: string; preview_url?: string } | null;
}

const DesignerOrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [designs, setDesigns] = useState<DesignVersion[]>([]);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [sendingItem, setSendingItem] = useState<string | null>(null);
  const [approvalFormItem, setApprovalFormItem] = useState<string | null>(null);
  const [designerMessages, setDesignerMessages] = useState<Record<string, string>>({});
  const [printingItem, setPrintingItem] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState<'approve' | 'reject' | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadOrder = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, customer_id, designer_id, template_id, status, details, created_at, updated_at, templates(name, service_type, preview_url)')
      .eq('id', orderId || '')
      .maybeSingle();

    if (data) {
      const { data: profileData } = await supabase
        .rpc('get_customer_names_for_designer', { customer_ids: [data.customer_id] });
      const profile = profileData?.[0] || null;
      setOrder({ ...data, profiles: profile });
    } else {
      setOrder(null);
    }
    setLoading(false);
  }, [orderId]);

  const loadItems = useCallback(async () => {
    if (!orderId) return;
    const { data } = await supabase
      .from('order_items')
      .select('*, templates(name, service_type, preview_url)')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    setOrderItems((data as unknown as OrderItem[]) || []);
    // Auto-expand first item
    if (data && data.length > 0 && !expandedItem) {
      setExpandedItem((data[0] as any).id);
    }
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
    loadItems();
    loadDesigns();
  }, [loadOrder, loadItems, loadDesigns]);

  // Realtime
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => loadOrder())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` }, () => loadItems())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'designs', filter: `order_id=eq.${orderId}` }, () => loadDesigns())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, loadOrder, loadItems, loadDesigns]);

  const getItemDesigns = (itemId: string) => designs.filter(d => d.order_item_id === itemId);

  // For legacy orders without items, get designs without order_item_id
  const getLegacyDesigns = () => designs.filter(d => !d.order_item_id);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = e.target.files?.[0];
    if (!file || !orderId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 10MB', variant: 'destructive' });
      return;
    }

    setUploadingItem(itemId);
    try {
      const itemDesigns = getItemDesigns(itemId);
      const nextVersion = itemDesigns.length > 0 ? itemDesigns[0].version + 1 : 1;
      const ext = file.name.split('.').pop();
      const filePath = `${orderId}/${itemId}/v${nextVersion}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('designs')
        .upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from('designs')
        .insert({ order_id: orderId, order_item_id: itemId, version: nextVersion, file_url: filePath });
      if (insertError) throw insertError;

      // Update item status
      await supabase.from('order_items').update({ status: 'design_uploaded' as any }).eq('id', itemId);

      toast({ title: 'تم رفع التصميم بنجاح', description: `الإصدار ${nextVersion}` });
      loadDesigns();
      loadItems();
    } catch (err: any) {
      toast({ title: 'فشل رفع الملف', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setUploadingItem(null);
      const ref = fileInputRefs.current[itemId];
      if (ref) ref.value = '';
    }
  };

  const handleSendForApproval = async (itemId: string) => {
    if (!orderId) return;
    setSendingItem(itemId);
    const item = orderItems.find(i => i.id === itemId);
    const currentDetails = item?.details || {};
    const messages = currentDetails.designer_messages || [];
    const msg = designerMessages[itemId]?.trim();
    if (msg) {
      const itemDesigns = getItemDesigns(itemId);
      messages.push({ text: msg, date: new Date().toISOString(), version: itemDesigns[0]?.version || 0 });
    }

    await supabase.from('order_items').update({
      status: 'waiting_approval' as any,
      details: { ...currentDetails, designer_messages: messages } as any,
    }).eq('id', itemId);

    // Check if all items are now waiting_approval or beyond
    const updatedItems = orderItems.map(i => i.id === itemId ? { ...i, status: 'waiting_approval' as OrderStatus } : i);
    const allWaiting = updatedItems.every(i => ['waiting_approval', 'approved', 'print_ready', 'printed', 'delivered'].includes(i.status));
    if (allWaiting) {
      await supabase.from('orders').update({ status: 'waiting_approval' as any }).eq('id', orderId);
    }

    toast({ title: 'تم إرسال التصميم للموافقة' });
    setDesignerMessages(prev => ({ ...prev, [itemId]: '' }));
    setApprovalFormItem(null);
    loadItems();
    loadOrder();
    setSendingItem(null);
  };

  const handleSendToPrint = async (itemId: string) => {
    if (!orderId) return;
    setPrintingItem(itemId);
    await supabase.from('order_items').update({ status: 'print_ready' as any }).eq('id', itemId);
    toast({ title: '✅ تم تحويل العنصر للطبع' });
    loadItems();
    setPrintingItem(null);
  };

  // Core: send a design file (already in the `designs` bucket) to the Telegram print group and
  // flip the item to print_ready. Throws on failure (so a failed send leaves the item approved
  // and retryable). State + toasts are handled by the callers below.
  const sendDesignToPrint = async (itemId: string, filePath: string) => {
    const { error: tgError } = await supabase.functions.invoke('send-to-telegram', { body: { orderId, orderItemId: itemId, designFilePath: filePath } });
    if (tgError) {
      // supabase-js collapses any non-2xx into a FunctionsHttpError whose generic message hides the
      // real reason (e.g. missing Telegram config). The raw Response is on `error.context` — read the
      // function's own `{ error }` body so the designer sees it.
      let message = (tgError as { message?: string })?.message || 'تعذّر إرسال التصميم للتلكرام';
      const ctx = (tgError as { context?: unknown }).context;
      if (ctx && typeof (ctx as Response).json === 'function') {
        try {
          const body = await (ctx as Response).json();
          if (body?.error) message = body.error as string;
        } catch { /* keep the fallback message */ }
      }
      throw new Error(message);
    }
    await supabase.from('order_items').update({ status: 'print_ready' as any }).eq('id', itemId);
  };

  // Primary path: send the already-approved design straight to the print group — no new file needed.
  const handleSendExistingToPrint = async (itemId: string) => {
    if (!orderId) return;
    const latest = getItemDesigns(itemId).find(d => d.file_url);
    if (!latest?.file_url) {
      toast({ title: 'لا يوجد تصميم مرفوع لإرساله', variant: 'destructive' });
      return;
    }
    setPrintingItem(itemId);
    try {
      await sendDesignToPrint(itemId, latest.file_url);
      toast({ title: '✅ تم إرسال التصميم للطبع' });
      loadDesigns();
      loadItems();
    } catch (err) {
      toast({ title: 'فشل الإرسال', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setPrintingItem(null);
    }
  };

  // Optional path: upload a separate print-ready file (e.g. a high-res TIF) and send that instead.

  // Reseller orders: designer reviews the uploaded design and either approves it
  // (which sends the file straight to the Telegram print group) or sends an edit
  // request back to the customer.
  const handleResellerReview = async (result: 'approved' | 'rejected') => {
    if (!orderId || !order) return;
    if (result === 'rejected' && !reviewNote.trim()) {
      toast({ title: 'اكتب التعديلات المطلوبة من الزبون', variant: 'destructive' });
      return;
    }
    setReviewSubmitting(result === 'approved' ? 'approve' : 'reject');
    try {
      const newDetails = {
        ...(order.details || {}),
        review: { result, note: reviewNote.trim() || null, at: new Date().toISOString() },
      };
      // Approve → move to printing stage. Reject → keep assigned so the customer can re-upload.
      const newStatus = result === 'approved' ? 'approved' : 'assigned';
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus as OrderStatus, details: newDetails })
        .eq('id', orderId);
      if (error) throw error;

      if (result === 'approved') {
        // Send the approved design file(s) directly to the Telegram print group.
        const designFileUrls: string[] = (order.details?.attachment_urls as string[]) || [];
        if (designFileUrls.length > 0) {
          const { error: tgError } = await supabase.functions.invoke('send-to-telegram', {
            body: { orderId, designFileUrls },
          });
          if (tgError) {
            toast({
              title: 'تمت الموافقة، لكن تعذّر الإرسال للتلكرام',
              description: 'الطلب معتمد — أعد المحاولة لإرسال الملف للطباعة.',
              variant: 'destructive',
            });
          } else {
            toast({ title: 'تمت الموافقة وأُرسل التصميم للطباعة ✅' });
          }
        } else {
          toast({ title: 'تمت الموافقة على التصميم ✅' });
        }
      } else {
        toast({ title: 'تم إرسال التعديل للزبون' });
      }

      setReviewNote('');
      loadOrder();
    } catch (err: any) {
      toast({ title: 'فشل العملية', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setReviewSubmitting(null);
    }
  };

  const handleViewDesign = async (filePath: string) => {
    const url = await getDesignSignedUrl(filePath);
    if (url) window.open(url, '_blank');
    else toast({ title: 'فشل فتح الملف', variant: 'destructive' });
  };

  const handleDeleteDesign = async (design: DesignVersion) => {
    if (!orderId || !design.file_url) return;
    try {
      await supabase.storage.from('designs').remove([design.file_url]);
      await supabase.from('designs').delete().eq('id', design.id);
      toast({ title: 'تم حذف الإصدار' });
      loadDesigns();
    } catch (err: any) {
      toast({ title: 'فشل الحذف', description: getUserFriendlyError(err), variant: 'destructive' });
    }
  };

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;
  if (!order) return <div className="py-20 text-center"><p className="text-muted-foreground text-lg">لم يتم العثور على الطلب</p></div>;

  const hasItems = orderItems.length > 0;
  const isReseller = order.details?.order_type === 'reseller';
  const resellerDetails = order.details || {};
  const review = resellerDetails.review;
  const resellerAttachments: string[] = resellerDetails.attachment_urls || [];
  const canReview = isReseller
    && order.status !== 'approved'
    && review?.result !== 'rejected'
    && !['print_ready', 'printed', 'delivered'].includes(order.status);
  const cellophaneLabel = resellerDetails.cellophane === 'glossy' ? 'لامع' : resellerDetails.cellophane === 'matte' ? 'مطفي' : null;

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
              <p className="text-muted-foreground text-sm mt-1">
                {order.profiles?.display_name || '-'}
                {hasItems && <span className="mr-2">• {orderItems.length} عناصر</span>}
              </p>
            </div>
            <StatusBadge status={order.status as OrderStatus} />
          </div>

          {/* Reseller order: design review flow */}
          {isReseller ? (
            <div className="space-y-4">
              {/* Order info */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary" />
                  طلب طباعة من مطبعة
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">المنتج</span>
                    <p className="text-foreground font-medium">{resellerDetails.service_label || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">الكمية</span>
                    <p className="text-foreground font-medium">{Number(resellerDetails.quantity || 0).toLocaleString('en-US')}</p>
                  </div>
                  {cellophaneLabel && (
                    <div>
                      <span className="text-muted-foreground text-xs">السلوفان</span>
                      <p className="text-foreground font-medium">{cellophaneLabel}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Uploaded design files */}
              <div className="bg-card rounded-xl border border-border p-4">
                <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" />
                  التصميم المرفوع ({resellerAttachments.length})
                </h4>
                {resellerAttachments.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {resellerAttachments.map((url, i) => {
                      const isImg = /\.(png|jpe?g|webp|gif)$/i.test(url);
                      return (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                          className="relative rounded-xl overflow-hidden border border-border/60 aspect-square bg-muted/20 group hover:border-primary/40 transition-colors flex items-center justify-center">
                          {isImg ? (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-center p-2">
                              <FileText className="w-8 h-8 text-primary mx-auto mb-1" />
                              <span className="text-[11px] text-muted-foreground">ملف {i + 1}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ExternalLink className="w-5 h-5 text-white" />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">لا يوجد ملف مرفوع</p>
                )}
              </div>

              {/* Approved state */}
              {order.status === 'approved' || ['print_ready', 'printed', 'delivered'].includes(order.status) ? (
                <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                  <p className="font-bold text-foreground text-sm">تمت الموافقة على التصميم</p>
                  <p className="text-muted-foreground text-xs mt-1">الطلب الآن في مرحلة الطباعة</p>
                </div>
              ) : review?.result === 'rejected' ? (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                  <p className="text-sm font-bold text-destructive mb-1 flex items-center gap-1.5">
                    <Pencil className="w-4 h-4" />
                    تم إرسال تعديل للزبون — بانتظار التعديل
                  </p>
                  {review.note && <p className="text-foreground text-sm mt-2 bg-card rounded-lg p-3 border border-border/50">{review.note}</p>}
                </div>
              ) : null}

              {/* Review actions */}
              {canReview && (
                <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    مراجعة التصميم
                  </h4>
                  <Textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    placeholder="التعديلات المطلوبة من الزبون (مطلوبة عند إرسال تعديل)..."
                    className="min-h-[70px] text-sm resize-none"
                    dir="rtl"
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleResellerReview('approved')}
                      disabled={reviewSubmitting !== null}
                      className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                    >
                      <CheckCircle2 className="w-4 h-4 ml-1" />
                      {reviewSubmitting === 'approve' ? 'جاري...' : 'موافقة وإرسال للطباعة'}
                    </Button>
                    <Button
                      onClick={() => handleResellerReview('rejected')}
                      disabled={reviewSubmitting !== null}
                      variant="outline"
                      className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <Pencil className="w-4 h-4 ml-1" />
                      {reviewSubmitting === 'reject' ? 'جاري...' : 'إرسال تعديل للزبون'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : hasItems ? (
            <div className="space-y-4">
              {orderItems.map((item, idx) => {
                const isExpanded = expandedItem === item.id;
                const itemDesigns = getItemDesigns(item.id);
                const canUpload = ['submitted', 'assigned', 'design_uploaded'].includes(item.status);
                const canSendApproval = ['submitted', 'assigned', 'design_uploaded'].includes(item.status) && itemDesigns.length > 0;
                const itemDetails = item.details || {};
                const revisions: any[] = itemDetails.revisions || [];

                return (
                  <div key={item.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    {/* Item Header - clickable */}
                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-right"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary font-bold text-sm">{idx + 1}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-sm">
                            {item.templates?.name || 'عنصر'}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {SERVICE_LABELS[item.templates?.service_type as ServiceType] || ''}
                            {itemDetails.quantity && ` • ${Number(itemDetails.quantity).toLocaleString()} نسخة`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={item.status} />
                        {itemDesigns.length > 0 && (
                          <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{itemDesigns.length} تصميم</span>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-border">
                        {/* Template Preview */}
                        {item.templates?.preview_url && (
                          <img src={item.templates.preview_url} alt="" className="w-full max-h-48 object-contain bg-muted/20" />
                        )}

                        {/* Customer Details for this item */}
                        <div className="p-4 border-b border-border">
                          {itemDetails.is_ai_design && (
                            <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                              <p className="text-sm font-bold text-primary flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                تصميم بالذكاء الاصطناعي (مسودة)
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                الصورة المرفقة نتاج الذكاء الاصطناعي — يرجى تدقيق النصوص العربية وإعادة تنضيدها وتجهيز الملف للطباعة بدقة.
                              </p>
                              {itemDetails.edit_request && (
                                <div className="mt-2 rounded-lg border border-accent/40 bg-accent/10 p-2.5">
                                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Pencil className="w-3.5 h-3.5 text-accent-foreground" />
                                    التعديلات المطلوبة من الزبون
                                  </p>
                                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap leading-relaxed">{itemDetails.edit_request}</p>
                                </div>
                              )}
                              {itemDetails.unit_price ? (
                                <p className="text-xs font-medium text-foreground mt-1">رسوم التصميم بالذكاء الاصطناعي: {Number(itemDetails.unit_price).toLocaleString('en-US')} د.ع</p>
                              ) : null}
                              {itemDetails.ai_prompt && (
                                <details className="mt-2">
                                  <summary className="text-xs text-primary cursor-pointer">عرض الوصف المُرسل للذكاء الاصطناعي</summary>
                                  <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap" dir="ltr">{itemDetails.ai_prompt}</p>
                                </details>
                              )}
                            </div>
                          )}
                          <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            تفاصيل الزبون
                          </h4>
                          {itemDetails.details ? (
                            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-xl p-4 border border-border/50">
                              {itemDetails.details}
                            </p>
                          ) : (
                            <p className="text-muted-foreground text-sm">لا توجد تفاصيل</p>
                          )}
                          {Array.isArray(itemDetails.attachment_urls) && itemDetails.attachment_urls.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
                                <Image className="w-4 h-4 text-primary" />
                                مرفقات ({itemDetails.attachment_urls.length})
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                {(itemDetails.attachment_urls as string[]).map((url: string, i: number) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="relative rounded-xl overflow-hidden border border-border/60 aspect-square bg-muted/20 group hover:border-primary/40 transition-colors">
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
                        <div className="p-4">
                          {canUpload && (
                            <div className="mb-4">
                              <input
                                ref={el => { fileInputRefs.current[item.id] = el; }}
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff"
                                onChange={e => handleFileSelect(e, item.id)}
                                className="hidden"
                              />
                              <div
                                onClick={() => uploadingItem !== item.id && fileInputRefs.current[item.id]?.click()}
                                className={cn(
                                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                                  uploadingItem === item.id ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-primary/5'
                                )}
                              >
                                {uploadingItem === item.id ? (
                                  <><RefreshCw className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" /><p className="text-foreground font-medium text-sm">جاري الرفع...</p></>
                                ) : (
                                  <><Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-foreground font-medium text-sm">{itemDesigns.length > 0 ? 'رفع إصدار جديد' : 'رفع التصميم'}</p><p className="text-muted-foreground text-xs mt-1">PDF, PNG, JPG, TIF — حتى 10MB</p></>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Design Versions */}
                          {itemDesigns.length > 0 && (
                            <div className="space-y-2 mb-4">
                              {itemDesigns.map((design, i) => (
                                <div key={design.id} className={cn('rounded-lg p-3 flex items-center justify-between gap-3', i === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border border-border')}>
                                  <div className="flex items-center gap-3">
                                    <FileText className={cn('w-4 h-4', i === 0 ? 'text-primary' : 'text-muted-foreground')} />
                                    <div>
                                      <p className="font-medium text-foreground text-sm">الإصدار {design.version} {i === 0 && <span className="text-primary text-xs mr-1">(الأحدث)</span>}</p>
                                      <p className="text-muted-foreground text-[11px]">{new Date(design.uploaded_at).toLocaleDateString('ar')}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {design.approved && <span className="text-[11px] bg-success/10 text-success px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />معتمد</span>}
                                    {design.file_url && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleViewDesign(design.file_url!)}><Eye className="w-3 h-3 ml-1" />عرض</Button>}
                                    {canUpload && !design.approved && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleDeleteDesign(design)}><Trash2 className="w-3 h-3" /></Button>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Send for Approval */}
                          {canSendApproval && (
                            <div className="space-y-3">
                              {approvalFormItem !== item.id ? (
                                <Button onClick={() => setApprovalFormItem(item.id)} size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl">
                                  <Send className="w-4 h-4 ml-2" />إرسال للموافقة
                                </Button>
                              ) : (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-3">
                                  <p className="text-sm font-bold text-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4 text-accent-foreground" />رسالة للزبون (اختياري)</p>
                                  <Textarea value={designerMessages[item.id] || ''} onChange={e => setDesignerMessages(prev => ({ ...prev, [item.id]: e.target.value }))} placeholder="مثال: تم التصميم حسب الطلب..." className="min-h-[60px] text-sm resize-none" dir="rtl" maxLength={500} />
                                  <div className="flex gap-2">
                                    <Button onClick={() => handleSendForApproval(item.id)} disabled={sendingItem === item.id} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                                      <Send className="w-4 h-4 ml-1" />{sendingItem === item.id ? 'جاري الإرسال...' : 'إرسال'}
                                    </Button>
                                    <Button onClick={() => setApprovalFormItem(null)} variant="outline">إلغاء</Button>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          )}

                          {/* Waiting approval state */}
                          {item.status === 'waiting_approval' && (
                            <div className="bg-accent/10 rounded-lg p-4 text-center">
                              <RefreshCw className="w-5 h-5 text-accent-foreground mx-auto mb-2" />
                              <p className="font-medium text-foreground text-sm">بانتظار موافقة الزبون</p>
                            </div>
                          )}

                          {/* Approved - send the final design straight to the print group */}
                          {item.status === 'approved' && (
                            <div className="space-y-3">
                              <div className="bg-success/10 rounded-lg p-4 text-center">
                                <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-2" />
                                <p className="font-medium text-foreground text-sm">تمت الموافقة!</p>
                                <p className="text-muted-foreground text-xs mt-1">أرسل التصميم النهائي للمطبعة</p>
                              </div>
                              <Button onClick={() => handleSendExistingToPrint(item.id)} disabled={printingItem === item.id} size="lg" className="w-full bg-success hover:bg-success/90 text-success-foreground rounded-xl">
                                <Printer className="w-4 h-4 ml-2" />{printingItem === item.id ? 'جاري الإرسال...' : 'إرسال للطبع 🖨'}
                              </Button>
                            </div>
                          )}

                          {item.status === 'print_ready' && (
                            <div className="bg-success/10 rounded-lg p-4 text-center">
                              <Printer className="w-5 h-5 text-success mx-auto mb-2" />
                              <p className="font-medium text-foreground text-sm">تم تحويل العنصر للطبع!</p>
                            </div>
                          )}

                          {/* Revision Notes */}
                          {revisions.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-border">
                              <div className="flex items-center gap-2 mb-3">
                                <MessageSquare className="w-4 h-4 text-destructive" />
                                <h4 className="font-bold text-foreground text-sm">ملاحظات الزبون</h4>
                              </div>
                              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 mb-2">
                                <p className="text-sm font-bold text-destructive mb-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />آخر تعديل
                                </p>
                                <p className="text-foreground text-sm">{revisions[revisions.length - 1].note}</p>
                              </div>
                              {revisions.length > 1 && revisions.slice(0, -1).reverse().map((rev: any, i: number) => (
                                <div key={i} className="bg-muted/50 rounded-lg p-3 border border-border mb-1.5">
                                  <p className="text-foreground text-sm">{rev.note}</p>
                                  <p className="text-[11px] text-muted-foreground mt-1">{new Date(rev.date).toLocaleDateString('ar')}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Legacy: single order without items - show old behavior */
            <div className="bg-card rounded-xl p-6 border border-border">
              <p className="text-muted-foreground text-center">هذا الطلب لا يحتوي على عناصر فرعية</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DesignerOrderDetails;
