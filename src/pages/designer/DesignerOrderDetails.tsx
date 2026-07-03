import { useParams, Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { ArrowRight, MessageSquare, Phone, Send } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SERVICE_LABELS, type OrderStatus, type ServiceType } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/errors';
import { retryAsync } from '@/lib/retry';
import { isAlreadyExistsError } from '@/services/orders';
import { notifyOrderStatusPush, notifyCustomerOfClarification } from '@/lib/orderStatusNotify';
import { getCustomerPhoneForDesigner, resolveDetailsPhone } from '@/lib/designerCustomer';
import type { OrderDetailsJson } from '@/types/db';
import ResellerOrderPanel from './ResellerOrderPanel';
import ItemlessOrderPanel from './ItemlessOrderPanel';
import DesignItemCard, { type DesignVersion, type OrderItem } from './DesignItemCard';
import {
  getCustomerNamesForDesigner,
  getDesignerOrderDetail,
  listOrderItemsForDesigner,
  uploadDesignFile,
  removeDesignFile,
  insertDesignVersion,
  insertOrderDesignVersion,
  insertDesignFace,
  insertOrderDesignFace,
  getServiceFacesByIds,
  setOrderItemStatus,
  setOrderItemStatusAndDetails,
  setOrderStatus,
  updateOrderStatusAndDetails,
  deleteDesignRecord,
  invokeSendToTelegram,
} from '@/services/designer';
import { listDesignsForOrder } from '@/services/orders';
import { nextFaceUpload, serviceFaceCount, FACE_LABELS, type DesignFace } from '@/lib/designUtils';
import type { FaceZoneState } from '@/components/designer/FaceUploadZones';

/** Latest-version face files (front then back) for a two-face design set, ready for print dispatch. */
function latestFaceFiles(designs: DesignVersion[]): { path: string; label: string }[] {
  const withFace = designs.filter(d => d.file_url && (d.face === 'front' || d.face === 'back'));
  if (withFace.length === 0) return [];
  const latest = Math.max(...withFace.map(d => d.version));
  const rows = withFace.filter(d => d.version === latest);
  const rank: Record<string, number> = { front: 0, back: 1 };
  rows.sort((a, b) => (rank[a.face ?? ''] ?? 9) - (rank[b.face ?? ''] ?? 9));
  return rows.map(d => ({ path: d.file_url as string, label: FACE_LABELS[d.face as DesignFace] }));
}

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
  // In-flight upload metadata + the File whose upload failed (drives the inline retry in the card).
  // Two-face uploads namespace their keys as `${itemId}:${face}` (single-face uses the bare itemId),
  // so uploadingItem/failedUploads/fileInputRefs are shared across both flows.
  const [uploadInfo, setUploadInfo] = useState<{ name: string; size: number } | null>(null);
  const [failedUploads, setFailedUploads] = useState<Record<string, File | null>>({});
  // service_type → face count (1 | 2). Drives which items/orders show two upload zones.
  const [serviceFaces, setServiceFaces] = useState<Record<string, 1 | 2>>({});
  // Customer contact (account phone via assigned-designer RPC, else the order's details phone).
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  // "اطلب توضيحاً من الزبون" mini-form.
  const [clarifOpen, setClarifOpen] = useState(false);
  const [clarifText, setClarifText] = useState('');
  const [clarifSending, setClarifSending] = useState(false);
  const [sendingItem, setSendingItem] = useState<string | null>(null);
  const [approvalFormItem, setApprovalFormItem] = useState<string | null>(null);
  const [designerMessages, setDesignerMessages] = useState<Record<string, string>>({});
  const [printingItem, setPrintingItem] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState<'approve' | 'reject' | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Item-less orders (template/ready-design): the design lives on the order row, not in order_items.
  const [orderUploading, setOrderUploading] = useState(false);
  const [orderPrinting, setOrderPrinting] = useState(false);
  const orderFileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Resolve how many faces each relevant service has (items' service_type + item-less order's
  // service_type) in ONE query, so cards/panels know whether to render two upload zones.
  useEffect(() => {
    const ids = new Set<string>();
    for (const it of orderItems) {
      const st = it.templates?.service_type;
      if (st) ids.add(st);
    }
    const orderServiceType = order?.details?.service_type;
    if (orderServiceType) ids.add(String(orderServiceType));
    if (ids.size === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await getServiceFacesByIds([...ids]);
      if (cancelled || !data) return;
      const map: Record<string, 1 | 2> = {};
      for (const s of data as unknown as { id: string; faces?: number }[]) map[s.id] = serviceFaceCount(s);
      setServiceFaces(map);
    })();
    return () => { cancelled = true; };
  }, [orderItems, order]);

  const itemFaces = (item: OrderItem): 1 | 2 => serviceFaces[item.templates?.service_type ?? ''] ?? 1;
  const orderFaces: 1 | 2 = serviceFaces[String(order?.details?.service_type ?? '')] ?? 1;

  // Build the per-face upload state a two-face card/panel needs (uploading/info/failed/hasExisting).
  const faceZoneState = (designSet: DesignVersion[], keyPrefix: string): { front: FaceZoneState; back: FaceZoneState } => {
    const zone = (face: DesignFace): FaceZoneState => {
      const key = `${keyPrefix}:${face}`;
      return {
        uploading: uploadingItem === key,
        info: uploadingItem === key ? uploadInfo : null,
        failed: failedUploads[key] ?? null,
        hasExisting: designSet.some(d => d.face === face && d.file_url),
      };
    };
    return { front: zone('front'), back: zone('back') };
  };

  // Customer contact: account phone via the assigned-designer RPC, falling back to whatever
  // phone the order's details JSON carries (delivery/reseller contact). Best-effort.
  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    (async () => {
      const account = await getCustomerPhoneForDesigner(order.customer_id);
      if (!cancelled) setCustomerPhone(account || resolveDetailsPhone(order.details));
    })();
    return () => { cancelled = true; };
  }, [order]);

  // Core upload used by both the file input and the inline retry. Uploads with retryAsync
  // (flaky-network resilience); a retry that lands after a lost-response success hits the
  // storage "already exists" error, which we treat as success (upsert is deliberately false).
  // `face` set (two-face products) ⇒ one row per face sharing a version (see nextFaceUpload); the
  // zone key is `${itemId}:${face}`. `face` omitted (single-face) keeps the exact original path.
  const performItemUpload = async (itemId: string, file: File, face?: DesignFace) => {
    if (!orderId) return;
    const zoneKey = face ? `${itemId}:${face}` : itemId;
    setUploadingItem(zoneKey);
    setUploadInfo({ name: file.name, size: file.size });
    try {
      const itemDesigns = getItemDesigns(itemId);
      const nextVersion = face
        ? nextFaceUpload(itemDesigns, face)
        : (itemDesigns.length > 0 ? itemDesigns[0].version + 1 : 1);
      const ext = file.name.split('.').pop();
      const filePath = face
        ? `${orderId}/${itemId}/v${nextVersion}-${face}.${ext}`
        : `${orderId}/${itemId}/v${nextVersion}.${ext}`;

      await retryAsync(async () => {
        const { error: uploadError } = await uploadDesignFile(filePath, file);
        if (uploadError && !isAlreadyExistsError(uploadError)) throw uploadError;
      }, { attempts: 3 });

      const { error: insertError } = face
        ? await insertDesignFace(orderId, itemId, nextVersion, filePath, face)
        : await insertDesignVersion(orderId, itemId, nextVersion, filePath);
      if (insertError) throw insertError;

      // Update item status
      await setOrderItemStatus(itemId, 'design_uploaded');

      setFailedUploads(prev => ({ ...prev, [zoneKey]: null }));
      toast({
        title: 'تم رفع التصميم بنجاح',
        description: face ? `${FACE_LABELS[face]} — الإصدار ${nextVersion}` : `الإصدار ${nextVersion}`,
      });
      loadDesigns();
      loadItems();
    } catch (e: unknown) {
      // Keep the File so the card can offer a one-tap إعادة المحاولة without re-picking.
      setFailedUploads(prev => ({ ...prev, [zoneKey]: file }));
      toast({ title: 'فشل رفع الملف', description: getUserFriendlyError(e), variant: 'destructive' });
    } finally {
      setUploadingItem(null);
      setUploadInfo(null);
      const ref = fileInputRefs.current[zoneKey];
      if (ref) ref.value = '';
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 10MB', variant: 'destructive' });
      return;
    }
    await performItemUpload(itemId, file);
  };

  const handleRetryUpload = (itemId: string) => {
    const file = failedUploads[itemId];
    if (file) void performItemUpload(itemId, file);
  };

  // Two-face item uploads: pick / retry a specific face.
  const handleItemFaceSelect = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string, face: DesignFace) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 10MB', variant: 'destructive' });
      return;
    }
    await performItemUpload(itemId, file, face);
  };

  const handleItemFaceRetry = (itemId: string, face: DesignFace) => {
    const file = failedUploads[`${itemId}:${face}`];
    if (file) void performItemUpload(itemId, file, face);
  };

  const handleSendForApproval = async (itemId: string) => {
    if (!orderId) return;
    setSendingItem(itemId);
    try {
      const item = orderItems.find(i => i.id === itemId);
      const currentDetails = item?.details || {};
      const messages = [...(currentDetails.designer_messages || [])];
      const msg = designerMessages[itemId]?.trim();
      if (msg) {
        const itemDesigns = getItemDesigns(itemId);
        messages.push({ text: msg, date: new Date().toISOString(), version: itemDesigns[0]?.version || 0 });
      }

      const { error: itemError } = await setOrderItemStatusAndDetails(itemId, 'waiting_approval', {
        ...currentDetails,
        designer_messages: messages,
      });
      if (itemError) throw itemError;

      // Check if all items are now waiting_approval or beyond
      const updatedItems = orderItems.map(i => i.id === itemId ? { ...i, status: 'waiting_approval' as OrderStatus } : i);
      const allWaiting = updatedItems.every(i => ['waiting_approval', 'approved', 'print_ready', 'printed', 'delivered'].includes(i.status));
      if (allWaiting) {
        const { error: orderError } = await setOrderStatus(orderId, 'waiting_approval');
        if (orderError) throw orderError;
        // The whole order is now ready for the customer to review — the single most
        // important customer moment. Push them so they come approve it.
        notifyOrderStatusPush(orderId, order?.customer_id, 'waiting_approval');
      }

      // Success side-effects ONLY after every write landed — a failed send must not
      // claim the customer was notified (the old version toasted success unconditionally).
      toast({ title: 'تم إرسال التصميم للموافقة' });
      setDesignerMessages(prev => ({ ...prev, [itemId]: '' }));
      setApprovalFormItem(null);
      loadItems();
      loadOrder();
    } catch (e: unknown) {
      toast({ title: 'فشل إرسال التصميم للموافقة', description: getUserFriendlyError(e), variant: 'destructive' });
    } finally {
      setSendingItem(null);
    }
  };

  // "اطلب توضيحاً من الزبون": persists the question where the customer already reads designer
  // messages (the expanded/first item's designer_messages; order-level details for item-less
  // orders) and pushes them. No status change — the order keeps flowing.
  const handleSendClarification = async () => {
    const text = clarifText.trim();
    if (!text || !orderId || !order) return;
    setClarifSending(true);
    try {
      if (orderItems.length > 0) {
        const target = orderItems.find(i => i.id === expandedItem) || orderItems[0];
        const details = target.details || {};
        const messages = [
          ...(details.designer_messages || []),
          { text, date: new Date().toISOString(), version: getItemDesigns(target.id)[0]?.version || 0, type: 'clarification' },
        ];
        const { error } = await setOrderItemStatusAndDetails(target.id, target.status, { ...details, designer_messages: messages });
        if (error) throw error;
      } else {
        const details = order.details || {};
        const messages = [
          ...((details.designer_messages as { text: string; date: string }[] | undefined) || []),
          { text, date: new Date().toISOString(), type: 'clarification' },
        ];
        const { error } = await updateOrderStatusAndDetails(orderId, order.status as OrderStatus, { ...details, designer_messages: messages });
        if (error) throw error;
      }
      notifyCustomerOfClarification(orderId, order.customer_id);
      toast({ title: 'أُرسل سؤالك للزبون 💬' });
      setClarifText('');
      setClarifOpen(false);
      loadItems();
      loadOrder();
    } catch (e: unknown) {
      toast({ title: 'فشل إرسال السؤال', description: getUserFriendlyError(e), variant: 'destructive' });
    } finally {
      setClarifSending(false);
    }
  };

  // Core: send a design file (already in the `designs` bucket) to the Telegram print group and
  // flip the item to print_ready. Throws on failure (so a failed send leaves the item approved
  // and retryable). State + toasts are handled by the callers below.
  // `payload` is the file part of the request: `{ designFilePath }` (single-face) or
  // `{ designFiles: [{path,label}, ...] }` (two-face — both faces, labelled).
  const sendDesignToPrint = async (itemId: string, payload: Record<string, unknown>) => {
    const { error: tgError } = await invokeSendToTelegram({ orderId, orderItemId: itemId, ...payload });
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
    // send-to-telegram flipped the ORDER to print_ready server-side — tell the customer.
    notifyOrderStatusPush(orderId, order?.customer_id, 'print_ready');
  };

  // Primary path: send the already-approved design straight to the print group — no new file needed.
  // Two-face products send BOTH faces of the latest version, each labelled.
  const handleSendExistingToPrint = async (itemId: string) => {
    if (!orderId) return;
    const itemDesigns = getItemDesigns(itemId);
    const item = orderItems.find(i => i.id === itemId);
    const twoFace = item ? itemFaces(item) === 2 : false;
    const faceFiles = twoFace ? latestFaceFiles(itemDesigns) : [];
    const latest = itemDesigns.find(d => d.file_url);
    if (twoFace) {
      if (faceFiles.length < 2) {
        toast({ title: 'ارفع الوجهين قبل الإرسال للطبع', variant: 'destructive' });
        return;
      }
    } else if (!latest?.file_url) {
      toast({ title: 'لا يوجد تصميم مرفوع لإرساله', variant: 'destructive' });
      return;
    }
    setPrintingItem(itemId);
    try {
      await sendDesignToPrint(itemId, twoFace ? { designFiles: faceFiles } : { designFilePath: latest!.file_url });
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
    const itemDesigns = getItemDesigns(item.id);
    const twoFace = itemFaces(item) === 2;
    const faceFiles = twoFace ? latestFaceFiles(itemDesigns) : [];
    const latest = itemDesigns.find(d => d.file_url);
    const attachments: string[] = Array.isArray(item.details?.attachment_urls) ? item.details.attachment_urls : [];
    if (twoFace) {
      if (faceFiles.length < 2) {
        toast({ title: 'ارفع الوجهين قبل الإرسال للطبع', description: 'هذا المنتج بوجهين — ارفع الوجه الأمامي والخلفي', variant: 'destructive' });
        return;
      }
    } else if (!latest?.file_url && attachments.length === 0) {
      toast({ title: 'لا يوجد تصميم لإرساله', description: 'ارفع ملف التصميم أو تأكد من وجود صورة مرفقة', variant: 'destructive' });
      return;
    }
    setPrintingItem(item.id);
    try {
      const body: Record<string, unknown> = twoFace
        ? { orderId, orderItemId: item.id, designFiles: faceFiles }
        : latest?.file_url
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
      // Direct approve+print (no customer round-trip): the order is now print_ready.
      notifyOrderStatusPush(orderId, order?.customer_id, 'print_ready');
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

      // Tell the customer the review outcome: approved (heading to print) vs. edits requested.
      // Reject writes DB status `assigned`, so we push the logical `revision` key instead.
      notifyOrderStatusPush(orderId, order.customer_id, result === 'approved' ? 'approved' : 'revision');

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

  // ── Item-less orders (template / ready-design): design lives on the order row ──
  // The designer uploads an order-level design (order_item_id IS NULL) and sends it to the
  // print group; the customer's item-less tracking view surfaces the same order-level design.
  // Order-level upload. `face` set (two-face item-less orders) ⇒ one row per face sharing a version
  // (nextFaceUpload) keyed `order:${face}` in the shared upload state; omitted keeps the original path.
  const performItemlessUpload = async (file: File, face?: DesignFace) => {
    if (!orderId) return;
    const zoneKey = `order:${face ?? ''}`;
    if (face) { setUploadingItem(zoneKey); setUploadInfo({ name: file.name, size: file.size }); }
    else setOrderUploading(true);
    try {
      const orderDesigns = designs.filter(d => !d.order_item_id);
      const nextVersion = face
        ? nextFaceUpload(orderDesigns, face)
        : (orderDesigns.length > 0 ? orderDesigns[0].version + 1 : 1);
      const ext = file.name.split('.').pop();
      const filePath = face
        ? `${orderId}/order/v${nextVersion}-${face}.${ext}`
        : `${orderId}/order/v${nextVersion}.${ext}`;

      const { error: uploadError } = await uploadDesignFile(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = face
        ? await insertOrderDesignFace(orderId, nextVersion, filePath, face)
        : await insertOrderDesignVersion(orderId, nextVersion, filePath);
      if (insertError) throw insertError;

      // Move the order forward so the customer sees progress (only from the pre-design states).
      if (order && ['submitted', 'assigned'].includes(order.status)) {
        await setOrderStatus(orderId, 'design_uploaded');
      }

      if (face) setFailedUploads(prev => ({ ...prev, [zoneKey]: null }));
      toast({
        title: 'تم رفع التصميم بنجاح',
        description: face ? `${FACE_LABELS[face]} — الإصدار ${nextVersion}` : `الإصدار ${nextVersion}`,
      });
      loadDesigns();
      loadOrder();
    } catch (err: unknown) {
      if (face) setFailedUploads(prev => ({ ...prev, [zoneKey]: file }));
      toast({ title: 'فشل رفع الملف', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      if (face) {
        setUploadingItem(null);
        setUploadInfo(null);
        const ref = fileInputRefs.current[zoneKey];
        if (ref) ref.value = '';
      } else {
        setOrderUploading(false);
        if (orderFileInputRef.current) orderFileInputRef.current.value = '';
      }
    }
  };

  const handleItemlessFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orderId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 10MB', variant: 'destructive' });
      return;
    }
    await performItemlessUpload(file);
  };

  // Two-face item-less uploads: pick / retry a specific face.
  const handleItemlessFaceSelect = async (e: React.ChangeEvent<HTMLInputElement>, face: DesignFace) => {
    const file = e.target.files?.[0];
    if (!file || !orderId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'الملف كبير جداً', description: 'الحد الأقصى 10MB', variant: 'destructive' });
      return;
    }
    await performItemlessUpload(file, face);
  };

  const handleItemlessFaceRetry = (face: DesignFace) => {
    const file = failedUploads[`order:${face}`];
    if (file) void performItemlessUpload(file, face);
  };

  const handleItemlessSendToPrint = async () => {
    if (!orderId) return;
    const orderDesigns = designs.filter(d => !d.order_item_id);
    const twoFace = orderFaces === 2;
    const faceFiles = twoFace ? latestFaceFiles(orderDesigns) : [];
    const latest = orderDesigns.find(d => d.file_url);
    const attachments: string[] = Array.isArray(order?.details?.attachment_urls) ? order!.details.attachment_urls : [];
    if (twoFace) {
      if (faceFiles.length < 2) {
        toast({ title: 'ارفع الوجهين قبل الإرسال للطبع', variant: 'destructive' });
        return;
      }
    } else if (!latest?.file_url && attachments.length === 0) {
      toast({ title: 'لا يوجد تصميم لإرساله', description: 'ارفع ملف التصميم أو تأكد من وجود ملف مرفق', variant: 'destructive' });
      return;
    }
    setOrderPrinting(true);
    try {
      // Uploaded design lives in the private `designs` bucket (designFilePath / designFiles); a
      // customer's own attachment is a public order-attachments URL (designFileUrls). The edge
      // function flips the order to print_ready on success.
      const body: Record<string, unknown> = twoFace
        ? { orderId, designFiles: faceFiles }
        : latest?.file_url
          ? { orderId, designFilePath: latest.file_url }
          : { orderId, designFileUrls: attachments };

      const { error: tgError } = await invokeSendToTelegram(body);
      if (tgError) {
        // supabase-js hides the real reason behind a generic FunctionsHttpError — read the
        // function's own `{ error }` body off error.context (same pattern as sendDesignToPrint).
        let message = (tgError as { message?: string })?.message || 'تعذّر إرسال التصميم للتلكرام';
        const ctx = (tgError as { context?: unknown }).context;
        if (ctx && typeof (ctx as Response).json === 'function') {
          try { const b = await (ctx as Response).json(); if (b?.error) message = b.error as string; } catch { /* keep fallback */ }
        }
        throw new Error(message);
      }
      // send-to-telegram flipped the (item-less) order to print_ready server-side.
      notifyOrderStatusPush(orderId, order?.customer_id, 'print_ready');
      toast({ title: '✅ تمت الموافقة وأُرسل التصميم للطبع' });
      loadDesigns();
      loadOrder();
    } catch (err) {
      toast({ title: 'فشل الإرسال', description: getUserFriendlyError(err), variant: 'destructive' });
    } finally {
      setOrderPrinting(false);
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
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">تفاصيل الطلب</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {order.profiles?.display_name || '-'}
                {hasItems && <span className="mr-2">• {orderItems.length} عناصر</span>}
              </p>
              {/* Customer contact + clarification — available on ALL order types */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {customerPhone && (
                  <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs">
                    <a href={`tel:${customerPhone}`}>
                      <Phone className="w-3.5 h-3.5 ml-1.5 text-primary" />
                      <span dir="ltr">{customerPhone}</span>
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  onClick={() => setClarifOpen(o => !o)}
                >
                  <MessageSquare className="w-3.5 h-3.5 ml-1.5 text-primary" />
                  اطلب توضيحاً من الزبون
                </Button>
              </div>
            </div>
            <StatusBadge status={order.status as OrderStatus} />
          </div>

          {/* Clarification mini-form */}
          {clarifOpen && (
            <div className="bg-card rounded-xl border border-border p-4 mb-6 space-y-3">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                سؤال توضيحي للزبون
              </p>
              <Textarea
                value={clarifText}
                onChange={e => setClarifText(e.target.value)}
                placeholder="مثال: ما هو الرقم الصحيح الذي تريده على الكارت؟"
                className="rounded-xl min-h-[70px]"
                maxLength={500}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSendClarification}
                  disabled={clarifSending || !clarifText.trim()}
                  className="rounded-lg"
                >
                  <Send className="w-3.5 h-3.5 ml-1.5" />
                  {clarifSending ? 'جاري الإرسال...' : 'إرسال السؤال'}
                </Button>
              </div>
            </div>
          )}

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
                  uploadInfo={uploadingItem === item.id ? uploadInfo : null}
                  failedUpload={failedUploads[item.id] ?? null}
                  sendingItem={sendingItem}
                  printingItem={printingItem}
                  approvalFormItem={approvalFormItem}
                  setApprovalFormItem={setApprovalFormItem}
                  designerMessages={designerMessages}
                  setDesignerMessages={setDesignerMessages}
                  fileInputRefs={fileInputRefs}
                  onFileSelect={handleFileSelect}
                  onRetryUpload={handleRetryUpload}
                  onSendForApproval={handleSendForApproval}
                  onApproveAndPrint={handleApproveAndPrint}
                  onSendExistingToPrint={handleSendExistingToPrint}
                  onDeleteDesign={handleDeleteDesign}
                  faces={itemFaces(item)}
                  faceState={itemFaces(item) === 2 ? faceZoneState(getItemDesigns(item.id), item.id) : null}
                  onFaceFileSelect={handleItemFaceSelect}
                  onFaceRetry={handleItemFaceRetry}
                />
              ))}
            </div>
          ) : (
            /* Item-less order (template / ready-design): design lives on the order row */
            <ItemlessOrderPanel
              orderStatus={order.status}
              details={order.details || {}}
              attachments={Array.isArray(order.details?.attachment_urls) ? order.details.attachment_urls.filter(Boolean) : []}
              serviceLabel={SERVICE_LABELS[order.details?.service_type as ServiceType] || order.templates?.name || ''}
              quantity={order.details?.quantity as number | undefined}
              total={order.details?.pricing?.line_total as number | undefined}
              orderDesigns={designs.filter(d => !d.order_item_id)}
              uploading={orderUploading}
              printing={orderPrinting}
              fileInputRef={orderFileInputRef}
              onFileSelect={handleItemlessFileSelect}
              onSendToPrint={handleItemlessSendToPrint}
              onDeleteDesign={handleDeleteDesign}
              faces={orderFaces}
              faceState={orderFaces === 2 ? faceZoneState(designs.filter(d => !d.order_item_id), 'order') : null}
              fileInputRefs={fileInputRefs}
              onFaceFileSelect={handleItemlessFaceSelect}
              onFaceRetry={handleItemlessFaceRetry}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DesignerOrderDetails;
