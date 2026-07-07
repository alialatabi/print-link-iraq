import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  listDesignsForOrder,
  uploadRevisionAttachment, approveDesignVersion,
  updateOrderItemDetails, cancelOrder,
} from '@/services/orders';
import { useOrderQuery, useOrderItemsQuery, ordersKeys } from '@/hooks/queries/useOrdersQuery';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { XCircle, RotateCcw, Loader2, Share2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { resolveReorder, type ReorderSourceItem } from '@/lib/reorder';
import { notifyDesignerOfCustomerAction } from '@/lib/orderStatusNotify';
import { formatProductCount } from '@/lib/arabicPlural';
import { shareContent, SITE_URL } from '@/lib/share';
import type { OrderStatus } from '@/data/mockData';
import { SERVICE_LABELS, ServiceType } from '@/data/mockData';
import { useServices } from '@/hooks/useServices';
import { toast } from '@/hooks/use-toast';
import { getDesignSignedUrl } from '@/lib/storage';
import { playNotificationSound } from '@/lib/notificationSound';
import { isNativeApp } from '@/lib/platform';
import { partitionAllowed } from '@/lib/uploadValidation';
import ImageLightbox from '@/components/ImageLightbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { OrderDetailsJson } from '@/types/db';
import OrderItemCard, { type DesignVersion, type OrderItem } from './OrderItemCard';
import ItemlessOrderView from './ItemlessOrderView';

interface OrderData {
  id: string;
  status: string;
  designer_id: string | null;
  details: OrderDetailsJson;
  templates?: { name?: string } | null;
}

const OrderTracking = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { services: allServices } = useServices();
  const { addItem } = useCart();

  // --- React Query for order + items ---
  const { data: orderData, isLoading: loading } = useOrderQuery(orderId);
  const order = (orderData ?? null) as unknown as OrderData | null;

  const { data: itemsData } = useOrderItemsQuery(orderId);
  const orderItems = ((itemsData ?? []) as unknown as OrderItem[]);

  // Auto-expand first item when items data arrives (mirrors original loadItems behaviour)
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  useEffect(() => {
    const items = (itemsData ?? []) as unknown as OrderItem[];
    if (items.length > 0) setExpandedItem(prev => prev || items[0].id);
  }, [itemsData]);

  // --- Local state (unchanged) ---
  const [designs, setDesigns] = useState<DesignVersion[]>([]);
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({});
  const [submittingItem, setSubmittingItem] = useState<string | null>(null);
  const [showRevisionItem, setShowRevisionItem] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [orderDesignUrl, setOrderDesignUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [revisionImages, setRevisionImages] = useState<Record<string, File[]>>({});
  const [revisionImagePreviews, setRevisionImagePreviews] = useState<Record<string, string[]>>({});
  const [reordering, setReordering] = useState(false);

  // --- loadDesigns stays manual (resolves signed URLs into multiple state maps) ---
  const loadDesigns = useCallback(async () => {
    const { data } = await listDesignsForOrder(orderId || '');
    const d = (data as DesignVersion[]) || [];
    setDesigns(d);
    // Auto-expand latest design inline for each item
    const itemIds = [...new Set(d.map(x => x.order_item_id).filter(Boolean))];
    for (const itemId of itemIds) {
      const latest = d.find(x => x.order_item_id === itemId && x.file_url);
      if (latest?.file_url) {
        const url = await getDesignSignedUrl(latest.file_url);
        if (url) setPreviewUrls(prev => ({ ...prev, [itemId!]: url, [`${itemId}_selected`]: latest.id, [`${itemId}_inline`]: url }));
      }
    }
    // Item-less orders: resolve the latest order-level design.
    const orderLevel = d.find(x => !x.order_item_id && x.file_url);
    if (orderLevel?.file_url) {
      const url = await getDesignSignedUrl(orderLevel.file_url);
      if (url) setOrderDesignUrl(url);
    }
  }, [orderId]);

  useEffect(() => { loadDesigns(); }, [loadDesigns]);

  // Realtime — order and items invalidate queries; designs stay manual
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase.channel(`tracking-${orderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'designs', filter: `order_id=eq.${orderId}` }, () => {
        playNotificationSound();
        toast({ title: '🎨 المصمم رفع تصميم جديد!' });
        loadDesigns();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ordersKeys.order(orderId) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` }, () => {
        playNotificationSound();
        toast({ title: '🔔 تحديث على طلبك' });
        queryClient.invalidateQueries({ queryKey: ordersKeys.orderItems(orderId) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, loadDesigns, queryClient]);

  const getItemDesigns = (itemId: string) => designs.filter(d => d.order_item_id === itemId);

  const handleApproveItem = async (itemId: string) => {
    if (!orderId) return;
    const itemDesigns = getItemDesigns(itemId);
    if (itemDesigns.length > 0) {
      // Approve every row of the LATEST version. Single-face = one row; two-face = both faces
      // (approval is per-version, not per-face) so the "معتمد" badge covers أمامي + خلفي.
      const latestVersion = itemDesigns[0].version;
      const latestRows = itemDesigns.filter(d => d.version === latestVersion);
      for (const d of latestRows) await approveDesignVersion(d.id);
    }
    await updateOrderItemDetails(itemId, 'approved', {
      ...(orderItems.find(i => i.id === itemId)?.details || {}),
      approved_at: new Date().toISOString(),
    });

    // Push to the assigned designer (best-effort, never blocks). Each approve action writes
    // exactly one item, so this fires ONE push per action — including the final approval
    // below, which doubles as the single order-level "all approved" push before we navigate.
    // The in-app notifications row for the designer is created by a DB trigger only when the
    // ORDER status flips to 'approved' (delivery-address step), so nothing is duplicated here.
    notifyDesignerOfCustomerAction(orderId, order?.designer_id, 'approved');

    // Check if all items approved
    const updated = orderItems.map(i => i.id === itemId ? { ...i, status: 'approved' as OrderStatus } : i);
    const allApproved = updated.every(i => ['approved', 'print_ready', 'printed', 'delivered'].includes(i.status));
    if (allApproved) {
      navigate(`/delivery-address/${orderId}`);
      return;
    }

    toast({ title: 'تمت الموافقة على هذا العنصر ✅' });
    queryClient.invalidateQueries({ queryKey: ordersKeys.orderItems(orderId) });
    loadDesigns();
  };

  const handleRevisionImageSelect = (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const files = Array.from(e.target.files || []);
    const { ok: allowed, rejected } = partitionAllowed(files);
    if (rejected.length) {
      toast({ title: 'صيغة غير مدعومة — PNG أو JPG فقط', variant: 'destructive' });
    }
    const current = revisionImages[itemId] || [];
    const combined = [...current, ...allowed].slice(0, 3);
    setRevisionImages(prev => ({ ...prev, [itemId]: combined }));
    setRevisionImagePreviews(prev => ({ ...prev, [itemId]: combined.map(f => URL.createObjectURL(f)) }));
    e.target.value = '';
  };

  const removeRevisionImage = (itemId: string, index: number) => {
    const updated = (revisionImages[itemId] || []).filter((_, i) => i !== index);
    setRevisionImages(prev => ({ ...prev, [itemId]: updated }));
    setRevisionImagePreviews(prev => ({ ...prev, [itemId]: updated.map(f => URL.createObjectURL(f)) }));
  };

  const handleRequestRevision = async (itemId: string) => {
    const note = revisionNotes[itemId]?.trim();
    if (!orderId || !note) return;
    setSubmittingItem(itemId);

    const uploadedUrls: string[] = [];
    for (const img of (revisionImages[itemId] || [])) {
      const ext = img.name.split('.').pop();
      const path = `${orderId}/${itemId}/revision-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await uploadRevisionAttachment(path, img);
      if (!error) uploadedUrls.push(path);
    }

    const item = orderItems.find(i => i.id === itemId);
    const currentDetails = item?.details || {};
    const revisions = currentDetails.revisions || [];
    const itemDesigns = getItemDesigns(itemId);
    revisions.push({ note, date: new Date().toISOString(), version: itemDesigns[0]?.version || 0, images: uploadedUrls });

    await updateOrderItemDetails(itemId, 'assigned', { ...currentDetails, revisions });

    // Push to the assigned designer (best-effort, never blocks). No DB trigger fires on
    // order_items updates, so without this the designer only notices on their next visit.
    notifyDesignerOfCustomerAction(orderId, order?.designer_id, 'revision');

    toast({ title: 'تم إرسال طلب التعديل للمصمم' });
    setRevisionNotes(prev => ({ ...prev, [itemId]: '' }));
    setRevisionImages(prev => ({ ...prev, [itemId]: [] }));
    setRevisionImagePreviews(prev => ({ ...prev, [itemId]: [] }));
    setShowRevisionItem(null);
    queryClient.invalidateQueries({ queryKey: ordersKeys.orderItems(orderId) });
    setSubmittingItem(null);
  };

  const handleCancelOrder = async () => {
    if (!orderId) return;
    const { error } = await cancelOrder(orderId);
    if (error) toast({ title: 'حدث خطأ', variant: 'destructive' });
    else { toast({ title: 'تم إلغاء الطلب' }); navigate('/my-orders'); }
  };

  // Share the order-tracking link. The tracking page is auth-guarded, so the recipient sees
  // the live status only after signing in (acceptable for v1 — it's the customer's own link).
  const handleShare = () => {
    if (!orderId) return;
    shareContent({
      title: 'تتبع الطلب - مطبعتي',
      text: 'تابع حالة طلبي في مطبعتي 🖨️',
      url: `${SITE_URL}/track-order/${orderId}`,
    });
  };

  // One-tap re-order: re-add this order's template items to the cart at CURRENT
  // prices, then go to the cart. Deleted/unavailable templates are surfaced.
  const handleReorder = async () => {
    if (reordering) return;
    // Variant-tier lines (size/shape/attributes) carry a `variant_id` in their details but
    // `resolveReorder` only knows the plain catalog price/min_quantity — re-adding one as if
    // it were a legacy item would silently swap in the WRONG size/price. Exclude them here
    // (reorder.ts's own contract assumes callers pre-filter variant lines) and surface them
    // as needing a manual re-pick, same as a genuinely-unavailable item.
    const variantSkipped = orderItems.filter(it => it.template_id && it.details?.variant_id).length;
    const source: ReorderSourceItem[] = orderItems
      .filter(it => it.template_id && !it.details?.variant_id)
      .map(it => ({ templateId: it.template_id, quantity: it.details?.quantity, cellophane: it.details?.cellophane }));
    if (source.length === 0) return;

    setReordering(true);
    try {
      const { items: reItems, skipped } = await resolveReorder(source);
      if (reItems.length === 0) {
        toast({ title: 'تعذّرت إعادة الطلب', description: 'المنتجات لم تعد متوفرة', variant: 'destructive' });
        return;
      }
      reItems.forEach(addItem);
      const skippedTotal = skipped.length + variantSkipped;
      toast({
        title: 'أُضيفت المنتجات إلى السلة ✓',
        description: skippedTotal > 0
          ? `تعذّر إضافة ${formatProductCount(skippedTotal)} تلقائياً`
          : undefined,
      });
      navigate('/cart');
    } catch {
      toast({ title: 'حدث خطأ', description: 'تعذّرت إعادة الطلب، حاول مرة أخرى', variant: 'destructive' });
    } finally {
      setReordering(false);
    }
  };

  if (loading) return <div className={isNativeApp ? 'py-16 text-center' : 'py-24 text-center'}><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" /></div>;
  if (!order) return <div className={isNativeApp ? 'py-16 text-center' : 'py-24 text-center'}><p className="text-muted-foreground text-sm">لم يتم العثور على الطلب</p></div>;

  const hasItems = orderItems.length > 0;
  // Variant-tier lines aren't handled by the one-tap reorder flow (see handleReorder) —
  // only surface the button when at least one item is actually reorderable that way.
  const canReorder = orderItems.some(it => it.template_id && !it.details?.variant_id);
  const isCompleted = (['delivered', 'printed', 'print_ready'] as string[]).includes(order.status);

  // Item-less orders: aggregate read-only display data from the order row itself.
  const od = order.details || {};
  const orderAttachments: string[] = Array.isArray(od.attachment_urls) ? od.attachment_urls.filter(Boolean) : [];
  const orderDesignUrls = [orderDesignUrl, ...orderAttachments].filter(Boolean) as string[];
  const orderServiceLabel = SERVICE_LABELS[od.service_type as ServiceType] || order.templates?.name || '';
  const orderQuantity = od.quantity as number | undefined;
  const orderTotal = od.pricing?.line_total as number | undefined;
  // Variant-tier orders (2026-07): denormalized on the order's own details for item-less
  // (upload / vault re-order) orders — absent on legacy orders, so ItemlessOrderView renders
  // exactly as before for those.
  const orderVariantLabel = od.variant_label as string | undefined;
  const orderUnitLabel = od.unit_label as string | undefined;
  const orderGiftQty = od.gift_quantity as number | undefined;
  const orderAttributes = od.attributes as Record<string, { label: string; value: string }> | undefined;
  const orderHasDelivery = Boolean(od.delivery_province || od.delivery_phone);
  const orderCancelled = order.status === 'cancelled';

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">تتبع الطلب</h1>
              <p className="text-muted-foreground text-sm mt-1">
                رقم الطلب: {order.id?.slice(0, 8)}...
                {hasItems && <span className="mr-2">• {orderItems.length} عناصر</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={order.status as OrderStatus} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="min-h-[44px] gap-1.5"
              >
                <Share2 className="w-4 h-4" />مشاركة
              </Button>
              {(['submitted', 'assigned', 'design_uploaded', 'waiting_approval'] as string[]).includes(order.status) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5">
                      <XCircle className="w-4 h-4" />إلغاء الطلب
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد إلغاء الطلب</AlertDialogTitle>
                      <AlertDialogDescription>هل أنت متأكد؟ لا يمكن التراجع.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>تراجع</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        نعم، إلغاء
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Reorder — re-add this order's template items to the cart */}
          {canReorder && (
            <div className="mb-6">
              <Button
                onClick={handleReorder}
                disabled={reordering}
                variant={isCompleted ? 'default' : 'outline'}
                className={`w-full h-12 rounded-xl gap-2 font-bold ${isCompleted ? 'bg-success hover:bg-success/90 text-success-foreground' : 'hover:border-primary/40 hover:text-primary'}`}
              >
                {reordering
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> جارٍ الإضافة...</>
                  : <><RotateCcw className="w-5 h-5" /> إعادة الطلب</>}
              </Button>
            </div>
          )}

          {/* Items */}
          {hasItems ? (
            <div className="space-y-4">
              {orderItems.map((item, idx) => (
                <OrderItemCard
                  key={item.id}
                  item={item}
                  idx={idx}
                  isExpanded={expandedItem === item.id}
                  onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                  itemDesigns={getItemDesigns(item.id)}
                  submittingItem={submittingItem}
                  showRevisionItem={showRevisionItem}
                  setShowRevisionItem={setShowRevisionItem}
                  revisionNote={revisionNotes[item.id] || ''}
                  onRevisionNoteChange={note => setRevisionNotes(prev => ({ ...prev, [item.id]: note }))}
                  revisionImagePreviews={revisionImagePreviews[item.id] || []}
                  revisionImageFiles={revisionImages[item.id] || []}
                  onRevisionImageSelect={e => handleRevisionImageSelect(e, item.id)}
                  onRemoveRevisionImage={index => removeRevisionImage(item.id, index)}
                  onApproveItem={() => handleApproveItem(item.id)}
                  onRequestRevision={() => handleRequestRevision(item.id)}
                  previewUrls={previewUrls}
                  setPreviewUrls={setPreviewUrls}
                  allServices={allServices}
                />
              ))}
            </div>
          ) : (
            <ItemlessOrderView
              orderStatus={order.status}
              orderDetails={od}
              orderDesignUrls={orderDesignUrls}
              orderServiceLabel={orderServiceLabel}
              orderQuantity={orderQuantity}
              orderTotal={orderTotal}
              orderVariantLabel={orderVariantLabel}
              orderUnitLabel={orderUnitLabel}
              orderGiftQty={orderGiftQty}
              orderAttributes={orderAttributes}
              orderHasDelivery={orderHasDelivery}
              orderCancelled={orderCancelled}
              onLightboxView={setLightboxUrl}
            />
          )}
        </motion.div>
      </div>

      <ImageLightbox
        src={lightboxUrl}
        open={!!lightboxUrl}
        onOpenChange={o => { if (!o) setLightboxUrl(null); }}
      />
    </div>
  );
};

export default OrderTracking;
