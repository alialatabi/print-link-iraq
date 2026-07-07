import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { STATUS_LABELS, SERVICE_LABELS, OrderStatus, ServiceType } from '@/data/mockData';
import { useServices } from '@/hooks/useServices';
import { useMyOrdersQuery, ordersKeys } from '@/hooks/queries/useOrdersQuery';
import type { OrderRow } from '@/hooks/queries/useOrdersQuery';
import { ShoppingBag, Package, ChevronLeft, ImageIcon, Layers, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { resolveReorder, type ReorderSourceItem } from '@/lib/reorder';
import { formatProductCount } from '@/lib/arabicPlural';
import { toast } from '@/hooks/use-toast';
import { playNotificationSound } from '@/lib/notificationSound';
import SEOHead from '@/components/SEOHead';
import { isNativeApp } from '@/lib/platform';
import { getDesignSignedUrl } from '@/lib/storage';
import { getOptimizedImageUrl } from '@/lib/imageUtils';
import { buildCatalog, computeLine } from '@/lib/orderPricing';
import type { OrderItemListRow } from '@/services/orders';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const MyOrders = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { services } = useServices();
  const { addItem } = useCart();
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const catalog = useMemo(() => buildCatalog(services), [services]);

  // One-tap re-order: re-add the order's template items to the cart at CURRENT
  // prices, then go to the cart. Deleted/unavailable templates are surfaced.
  const handleReorder = useCallback(async (e: React.MouseEvent, order: OrderRow) => {
    e.stopPropagation(); // don't trigger the card's navigate-to-tracking
    if (reorderingId) return;
    // Variant-tier lines (size/shape/attributes) carry a `variant_id` in their details but
    // `resolveReorder` only knows the plain catalog price/min_quantity — re-adding one as if
    // it were a legacy item would silently swap in the WRONG size/price. Exclude them here
    // (reorder.ts's own contract assumes callers pre-filter variant lines) and surface them
    // as needing a manual re-pick, same as a genuinely-unavailable item.
    const variantSkipped = order._items.filter(it => it.template_id && it.details?.variant_id).length;
    const source: ReorderSourceItem[] = order._items
      .filter(it => it.template_id && !it.details?.variant_id)
      .map(it => ({ templateId: it.template_id, quantity: it.details?.quantity, cellophane: it.details?.cellophane }));
    if (source.length === 0) return;

    setReorderingId(order.id);
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
      setReorderingId(null);
    }
  }, [reorderingId, addItem, navigate]);

  // React Query — base order list (no signed URLs)
  const { data: ordersBase, isLoading: loading } = useMyOrdersQuery(user?.id, role === 'admin');

  // Signed-URL overrides for designer thumbnails — resolved progressively
  // after the query data arrives, exactly as the original loadOrders did.
  const [thumbOverrides, setThumbOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!ordersBase) return;
    setThumbOverrides({});
    ordersBase.forEach(async (o) => {
      if (!o._designPath) return;
      const url = await getDesignSignedUrl(o._designPath);
      if (url) setThumbOverrides(prev => ({ ...prev, [o.id]: url }));
    });
  }, [ordersBase]);

  // Merge public thumbnails with signed-URL overrides
  const orders: OrderRow[] = (ordersBase ?? []).map(o => ({
    ...o,
    _thumb: thumbOverrides[o.id] || o._thumb,
  }));

  // Total charged for an order: sum of per-item snapshots, or the order-level
  // snapshot for item-less orders (uploads / vault re-orders), falling back
  // to the live catalog for legacy rows.
  const orderTotal = useCallback((order: OrderRow): number => {
    if (order._items.length > 0) {
      return order._items.reduce(
        (sum, it) =>
          sum + computeLine(it.details, catalog, it.templates?.service_type).revenue,
        0,
      );
    }
    return computeLine(order.details, catalog, order.templates?.service_type).revenue;
  }, [catalog]);

  // Realtime — invalidate the query on any relevant table change
  useEffect(() => {
    if (!user) return;
    const isAdmin = role === 'admin';
    const channel = supabase
      .channel('my-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as { customer_id?: string; status?: string };
        const old = payload.old as { customer_id?: string; status?: string };
        if (isAdmin || row?.customer_id === user.id || old?.customer_id === user.id) {
          if (payload.eventType === 'UPDATE' && row?.status !== old?.status) {
            const label = STATUS_LABELS[row.status as OrderStatus] || row.status;
            playNotificationSound();
            toast({ title: `🔔 تحديث على طلبك`, description: label });
          }
          queryClient.invalidateQueries({ queryKey: ordersKeys.myOrders(user.id, isAdmin) });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ordersKeys.myOrders(user.id, isAdmin) });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'designs' }, () => {
        queryClient.invalidateQueries({ queryKey: ordersKeys.myOrders(user.id, isAdmin) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, role, queryClient]);

  if (loading) return (
    <div className={isNativeApp ? 'py-16 text-center' : 'py-24 text-center'}>
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
    </div>
  );

  return (
    <div className={isNativeApp ? 'pt-4 pb-10' : 'section-spacing-sm'}>
      <SEOHead title="طلباتي" description="تتبع جميع طلباتك ومعرفة حالتها - مطبعتي" canonical="/my-orders" noindex />
      <div className="container max-w-3xl">
        {/* Header */}
        <div className={`flex items-center gap-3 ${isNativeApp ? 'mb-6' : 'mb-8'}`}>
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">طلباتي</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {orders.length > 0 ? `${orders.length} ${orders.length === 1 ? 'طلب' : 'طلبات'}` : 'تتبّع حالة كل طلباتك'}
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className={isNativeApp ? 'text-center py-16' : 'text-center py-28'}>
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-sm mb-6">لا توجد طلبات حتى الآن</p>
            <Link to="/services">
              <Button className="bg-success hover:bg-success/90 text-success-foreground rounded-xl">
                ابدأ طلبك الأول
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {orders.map((order, i) => {
              const items = order._items;
              const multi = items.length > 1;
              const title = multi
                ? `${items.length} عناصر`
                : (items[0]?.templates?.name || order.templates?.name || 'تصميم جاهز');
              const serviceType = (items[0]?.templates?.service_type || order.templates?.service_type || order.details?.service_type) as ServiceType | undefined;
              const serviceLabel = serviceType ? (SERVICE_LABELS[serviceType] || '') : '';
              const quantity = (items[0]?.details?.quantity ?? order.details?.quantity) as number | undefined;
              // Variant-tier orders (2026-07): denormalized fields on the line's details — legacy
              // orders simply don't have them, so every one of these stays undefined for them.
              const firstItemDetails = items[0]?.details ?? order.details;
              const variantLabel = firstItemDetails?.variant_label as string | undefined;
              const unitLabel = firstItemDetails?.unit_label as string | undefined;
              const giftQty = firstItemDetails?.gift_quantity as number | undefined;
              const attributes = firstItemDetails?.attributes as Record<string, { label: string; value: string }> | undefined;
              const attributesLabel = attributes ? Object.values(attributes).map(a => `${a.label}: ${a.value}`).join('، ') : '';
              const quantityLabel = quantity != null
                ? (unitLabel ? `${quantity.toLocaleString('en-US')} ${unitLabel}` : `الكمية: ${quantity.toLocaleString('en-US')}`)
                : '';
              const total = orderTotal(order);
              // Variant-tier lines aren't handled by the one-tap reorder flow (see
              // handleReorder) — only surface the button when at least one item is
              // actually reorderable that way.
              const canReorder = items.some(it => it.template_id && !it.details?.variant_id);
              const isDelivered = order.status === 'delivered';
              const isReordering = reorderingId === order.id;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  onClick={() => navigate(`/track-order/${order.id}`)}
                  className="group bg-card rounded-2xl border border-border/60 shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-200 cursor-pointer overflow-hidden"
                >
                  <div className="flex items-stretch gap-3.5 p-3.5">
                    {/* Design thumbnail */}
                    <div className="w-[88px] h-[88px] rounded-xl overflow-hidden bg-gradient-to-br from-muted/60 to-muted/30 flex-shrink-0 flex items-center justify-center relative">
                      {order._thumb ? (
                        <img
                          src={getOptimizedImageUrl(order._thumb, { width: 220, height: 220 })}
                          alt={title}
                          loading="lazy"
                          draggable={false}
                          onContextMenu={(e) => e.preventDefault()}
                          className="w-full h-full object-cover select-none"
                        />
                      ) : (
                        multi
                          ? <Layers className="w-8 h-8 text-muted-foreground/40" />
                          : <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      )}
                      {multi && order._thumb && (
                        <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-foreground/70 text-background px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                          +{items.length}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-foreground text-sm leading-tight truncate">{title}</h3>
                          {(serviceLabel || variantLabel || quantityLabel) && (
                            <p className="text-muted-foreground text-xs mt-1 truncate">
                              {[serviceLabel, variantLabel, quantityLabel].filter(Boolean).join(' · ')}
                              {giftQty ? ` +${giftQty.toLocaleString('en-US')} هدية` : ''}
                            </p>
                          )}
                          {attributesLabel && (
                            <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{attributesLabel}</p>
                          )}
                          {multi && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {items.slice(0, 2).map((it: OrderItemListRow, idx: number) => (
                                <span key={idx} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground truncate max-w-[90px]">
                                  {it.templates?.name || SERVICE_LABELS[it.templates?.service_type as ServiceType] || 'عنصر'}
                                </span>
                              ))}
                              {items.length > 2 && <span className="text-[10px] text-muted-foreground">+{items.length - 2}</span>}
                            </div>
                          )}
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      {/* Footer: date + price */}
                      <div className="flex items-end justify-between gap-2 mt-auto pt-2">
                        <span className="text-[11px] text-muted-foreground tabular-nums" dir="ltr">{fmtDate(order.created_at)}</span>
                        <div className="flex items-center gap-1">
                          {total > 0 && (
                            <span className="font-extrabold text-success text-sm tabular-nums">
                              {total.toLocaleString('en-US')}
                              <span className="text-[10px] font-semibold text-success/70 mr-0.5">د.ع</span>
                            </span>
                          )}
                          <ChevronLeft className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reorder — re-add this order's template items to the cart */}
                  {canReorder && (
                    <div className="px-3.5 pb-3.5">
                      <Button
                        variant="outline"
                        onClick={(e) => handleReorder(e, order)}
                        disabled={isReordering}
                        className={`w-full h-11 rounded-xl gap-2 font-bold text-sm ${isDelivered ? 'border-success/40 text-success hover:bg-success/10 hover:text-success' : 'hover:border-primary/40 hover:text-primary'}`}
                      >
                        {isReordering
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الإضافة...</>
                          : <><RotateCcw className="w-4 h-4" /> إعادة الطلب</>}
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
