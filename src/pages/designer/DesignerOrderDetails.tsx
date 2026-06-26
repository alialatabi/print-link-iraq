import { useParams, Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { ArrowRight } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { OrderStatus } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { getDesignSignedUrl } from '@/lib/storage';
import { getUserFriendlyError } from '@/lib/errors';
import type { OrderDetailsJson } from '@/types/db';
import ResellerOrderPanel from './ResellerOrderPanel';
import DesignItemCard, { type DesignVersion, type OrderItem } from './DesignItemCard';
import {
  getCustomerNamesForDesigner,
  getDesignerOrderDetail,
  listOrderItemsForDesigner,
  uploadDesignFile,
  removeDesignFile,
  insertDesignVersion,
  setOrderItemStatus,
  setOrderItemStatusAndDetails,
  setOrderStatus,
  updateOrderStatusAndDetails,
  deleteDesignRecord,
  invokeSendToTelegram,
} from '@/services/designer';
import { listDesignsForOrder } from '@/services/orders';

interface OrderWithProfile {
  id: string;
  customer_id: string;
  designer_id: string | null;
  template_id: string | null;
  status: string;
  details: OrderDetailsJson;
  created_at: string;
  updated_at: string;
  templates?: { name: string; service_type: string; preview_url?: string | null } | null;
  profiles: { display_name: string | null; user_id: string } | null;
}

const DesignerOrderDetails = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderWithProfile | null>(null);
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
    const { data } = await getDesignerOrderDetail(orderId || '');

    if (data) {
      const { data: profileData } = await getCustomerNamesForDesigner([data.customer_id]);
      const profile = profileData?.[0] || null;
      setOrder({ ...data, profiles: profile } as OrderWithProfile);
    } else {
      setOrder(null);
    }
    setLoading(false);
  }, [orderId]);

  const loadItems = useCallback(async () => {
    if (!orderId) return;
    const { data } = await listOrderItemsForDesigner(orderId);
    setOrderItems((data as unknown as OrderItem[]) || []);
    // Auto-expand first item — functional update avoids expandedItem in useCallback deps
    if (data && data.length > 0) {
      setExpandedItem(prev => prev || data[0].id);
    }
  }, [orderId]);

  const loadDesigns = useCallback(async () => {
    const { data } = await listDesignsForOrder(orderId || '');
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

      const { error: uploadError } = await uploadDesignFile(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await insertDesignVersion(orderId, itemId, nextVersion, filePath);
      if (insertError) throw insertError;

      // Update item status
      await setOrderItemStatus(itemId, 'design_uploaded');

      toast({ title: 'تم رفع التصميم بنجاح', description: `الإصدار ${nextVersion}` });
      loadDesigns();
      loadItems();
    } catch (e: unknown) {
      toast({ title: 'فشل رفع الملف', description: getUserFriendlyError(e), variant: 'destructive' });
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

    await setOrderItemStatusAndDetails(itemId, 'waiting_approval', {
      ...currentDetails,
      designer_messages: messages,
    });

    // Check if all items are now waiting_approval or beyond
    const updatedItems = orderItems.map(i => i.id === itemId ? { ...i, status: 'waiting_approval' as OrderStatus } : i);
    const allWaiting = updatedItems.every(i => ['waiting_approval', 'approved', 'print_ready', 'printed', 'delivered'].includes(i.status));
    if (allWaiting) {
      await setOrderStatus(orderId, 'waiting_approval');
    }

    toast({ title: 'تم إرسال التصميم للموافقة' });
    setDesignerMessages(prev => ({ ...prev, [itemId]: '' }));
    setApprovalFormItem(null);
    loadItems();
    loadOrder();
    setSendingItem(null);
  };

  // Core: send a design file (already in the `designs` bucket) to the Telegram print group and
  // flip the item to print_ready. Throws on failure (so a failed send leaves the item approved
  // and retryable). State + toasts are handled by the callers below.
  const sendDesignToPrint = async (itemId: string, filePath: string) => {
    const { error: tgError } = await invokeSendToTelegram({ orderId, orderItemId: itemId, designFilePath: filePath });
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
    await setOrderItemStatus(itemId, 'print_ready');
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

  // Direct approval: designer approves the design and sends it straight to the print group in one
  // step — no customer approval round-trip. Sends the latest uploaded file if present, otherwise the
  // customer's attached AI image(s). Flips the item to print_ready (the edge function flips the order).
  const handleApproveAndPrint = async (item: OrderItem) => {
    if (!orderId) return;
    const latest = getItemDesigns(item.id).find(d => d.file_url);
    const attachments: string[] = Array.isArray(item.details?.attachment_urls) ? item.details.attachment_urls : [];
    if (!latest?.file_url && attachments.length === 0) {
      toast({ title: 'لا يوجد تصميم لإرساله', description: 'ارفع ملف التصميم أو تأكد من وجود صورة مرفقة', variant: 'destructive' });
      return;
    }
    setPrintingItem(item.id);
    try {
      const body: Record<string, unknown> = latest?.file_url
        ? { orderId, orderItemId: item.id, designFilePath: latest.file_url }
        : { orderId, orderItemId: item.id, designFileUrls: attachments };

      const { error: tgError } = await invokeSendToTelegram(body);
      if (tgError) {
        // supabase-js hides the real reason behind a generic FunctionsHttpError — read the function's
        // own `{ error }` body off error.context (same pattern as sendDesignToPrint).
        let message = (tgError as { message?: string })?.message || 'تعذّر إرسال التصميم للتلكرام';
        const ctx = (tgError as { context?: unknown }).context;
        if (ctx && typeof (ctx as Response).json === 'function') {
          try { const b = await (ctx as Response).json(); if (b?.error) message = b.error as string; } catch { /* keep fallback */ }
        }
        throw new Error(message);
      }
      await setOrderItemStatus(item.id, 'print_ready');
      toast({ title: '✅ تمت الموافقة وأُرسل التصميم للطبع' });
      loadDesigns();
      loadItems();
      loadOrder();
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
      const { error } = await updateOrderStatusAndDetails(orderId, newStatus as OrderStatus, newDetails);
      if (error) throw error;

      if (result === 'approved') {
        // Send the approved design file(s) directly to the Telegram print group.
        const designFileUrls: string[] = (order.details?.attachment_urls as string[]) || [];
        if (designFileUrls.length > 0) {
          const { error: tgError } = await invokeSendToTelegram({ orderId, designFileUrls });
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
    } catch (e: unknown) {
      toast({ title: 'فشل العملية', description: getUserFriendlyError(e), variant: 'destructive' });
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
      await removeDesignFile(design.file_url);
      await deleteDesignRecord(design.id);
      toast({ title: 'تم حذف الإصدار' });
      loadDesigns();
    } catch (e: unknown) {
      toast({ title: 'فشل الحذف', description: getUserFriendlyError(e), variant: 'destructive' });
    }
  };

  if (loading) return <div className="py-20 text-center"><p className="text-muted-foreground">جاري التحميل...</p></div>;
  if (!order) return <div className="py-20 text-center"><p className="text-muted-foreground text-lg">لم يتم العثور على الطلب</p></div>;

  const hasItems = orderItems.length > 0;
  const isReseller = order.details?.order_type === 'reseller';
  const resellerDetails = order.details || {};
  const resellerAttachments: string[] = resellerDetails.attachment_urls || [];
  const canReview = isReseller
    && order.status !== 'approved'
    && resellerDetails.review?.result !== 'rejected'
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
            <ResellerOrderPanel
              orderStatus={order.status}
              resellerDetails={resellerDetails}
              resellerAttachments={resellerAttachments}
              cellophaneLabel={cellophaneLabel}
              canReview={canReview}
              reviewNote={reviewNote}
              setReviewNote={setReviewNote}
              reviewSubmitting={reviewSubmitting}
              onReview={handleResellerReview}
            />
          ) : hasItems ? (
            <div className="space-y-4">
              {orderItems.map((item, idx) => (
                <DesignItemCard
                  key={item.id}
                  item={item}
                  idx={idx}
                  isExpanded={expandedItem === item.id}
                  onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  itemDesigns={getItemDesigns(item.id)}
                  uploadingItem={uploadingItem}
                  sendingItem={sendingItem}
                  printingItem={printingItem}
                  approvalFormItem={approvalFormItem}
                  setApprovalFormItem={setApprovalFormItem}
                  designerMessages={designerMessages}
                  setDesignerMessages={setDesignerMessages}
                  fileInputRefs={fileInputRefs}
                  onFileSelect={handleFileSelect}
                  onSendForApproval={handleSendForApproval}
                  onApproveAndPrint={handleApproveAndPrint}
                  onSendExistingToPrint={handleSendExistingToPrint}
                  onViewDesign={handleViewDesign}
                  onDeleteDesign={handleDeleteDesign}
                />
              ))}
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
