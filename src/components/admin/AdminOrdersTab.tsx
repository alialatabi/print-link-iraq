import type { Dispatch, SetStateAction } from 'react';
import { m as motion } from 'framer-motion';
import StatusBadge from '@/components/StatusBadge';
import { STATUS_LABELS, OrderStatus } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ORDER_STATUSES } from '@/lib/constants';
import {
  Package, Palette, User,
  Search, Calendar,
  FileText, Download,
  XCircle, MapPin, Phone, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { AdminOrder, DesignerProfile, DesignerWorkloadItem, QuickFilter } from './adminTypes';
import type { OrderDetailsJson } from '@/types/db';

interface Props {
  orders: AdminOrder[];
  filteredOrders: AdminOrder[];
  designers: DesignerProfile[];
  designerWorkload: DesignerWorkloadItem[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  serviceFilter: string;
  setServiceFilter: (v: string) => void;
  designerFilter: string;
  setDesignerFilter: (v: string) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  quickFilter: QuickFilter;
  setQuickFilter: (v: QuickFilter) => void;
  openOrders: Set<string>;
  setOpenOrders: Dispatch<SetStateAction<Set<string>>>;
  SERVICE_LABELS: Record<string, string>;
  handleStatusChange: (orderId: string, newStatus: string) => void;
  handleAssignDesigner: (orderId: string, designerId: string) => void;
  handleCancelOrder: (orderId: string) => void;
  downloadDesignFromBucket: (filePath: string, filename: string) => Promise<void>;
  downloadDesignFromUrl: (url: string, filename: string) => void;
}

const AdminOrdersTab = ({
  orders,
  filteredOrders,
  designers,
  designerWorkload,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  serviceFilter,
  setServiceFilter,
  designerFilter,
  setDesignerFilter,
  sortBy,
  setSortBy,
  quickFilter,
  setQuickFilter,
  openOrders,
  setOpenOrders,
  SERVICE_LABELS,
  handleStatusChange,
  handleAssignDesigner,
  handleCancelOrder,
  downloadDesignFromBucket,
  downloadDesignFromUrl,
}: Props) => {
  const toggleOrder = (id: string) => setOpenOrders(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
      {/* Advanced Filters */}
      <div className="bg-card rounded-xl p-4 border border-border mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الهاتف..."
              className="pr-9 rounded-lg"
            />
          </div>
          {/* Status */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              {ORDER_STATUSES.map(s => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]} ({orders.filter(o => o.status === s).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Service */}
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="الخدمة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الخدمات</SelectItem>
              {Object.entries(SERVICE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Designer */}
          <Select value={designerFilter} onValueChange={setDesignerFilter}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="المصمم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المصممين</SelectItem>
              <SelectItem value="unassigned">غير معيّن</SelectItem>
              {designers.map(d => (
                <SelectItem key={d.user_id} value={d.user_id}>
                  {d.display_name || d.phone || 'مصمم'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="الترتيب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث أولاً</SelectItem>
              <SelectItem value="oldest">الأقدم أولاً</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1">
            عرض <span className="font-bold text-foreground">{filteredOrders.length}</span> من {orders.length} طلب
          </span>
          <div className="flex items-center gap-3">
            {filteredOrders.length > 0 && (
              <button
                onClick={() => setOpenOrders(prev => (prev.size > 0 ? new Set() : new Set(filteredOrders.map(o => o.id))))}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                {openOrders.size > 0 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {openOrders.size > 0 ? 'طي الكل' : 'توسيع الكل'}
              </button>
            )}
            {quickFilter && (
              <button
                onClick={() => setQuickFilter(null)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <span>✕</span>
                مسح فلتر: {quickFilter === 'pending' ? 'بانتظار التعيين' : quickFilter === 'inprogress' ? 'قيد التنفيذ' : 'مكتملة'}
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">لا توجد طلبات مطابقة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order, i) => {
            const details = (order.details || {}) as OrderDetailsJson;
            const isReseller = details.order_type === 'reseller';
            const resellerAttachments: string[] = isReseller ? (details.attachment_urls || []) : [];
            const DETAIL_LABELS: Record<string, string> = {
              name: 'الاسم', phone: 'الهاتف', job_title: 'المسمى الوظيفي',
              address: 'العنوان', email: 'البريد', notes: 'ملاحظات',
              quantity: 'الكمية', cellophane: 'السلوفان', delivery_phone: 'هاتف التوصيل',
              delivery_province: 'المحافظة', delivery_area: 'المنطقة',
              delivery_landmark: 'أقرب نقطة دالة', delivery_label: 'عنوان التوصيل',
              approved_at: 'تاريخ الموافقة',
            };
            const deliveryKeys = ['delivery_province', 'delivery_area', 'delivery_landmark', 'delivery_label', 'delivery_phone'];
            // Reseller bookkeeping keys are shown via a dedicated block, not as raw fields.
            const hiddenKeys = ['order_type', 'service_type', 'service_label', 'attachment_urls', 'pricing'];
            const hasDelivery = deliveryKeys.some(k => details[k]);
            const contentFields = Object.entries(details)
              .filter(([key, val]) => !deliveryKeys.includes(key) && !hiddenKeys.includes(key) && key !== 'approved_at' && val && typeof val !== 'object')
              .map(([key, val]) => ({ key, label: DETAIL_LABELS[key] || key, value: String(val) }));
            const deliveryFields = deliveryKeys
              .filter(k => details[k])
              .map(k => ({ key: k, label: DETAIL_LABELS[k] || k, value: String(details[k]) }));

            // Collect every downloadable design file for this order:
            //  - order-level uploaded files (reseller ready designs, customer "ready_design" uploads)
            //  - item-level uploaded files (AI-design images, per-item customer attachments)
            //  - designer-produced designs (latest version per item) from the private bucket
            const extOf = (p: string) => (p.split('?')[0].split('.').pop() || 'file').toLowerCase();
            const shortId = order.id.slice(0, 8);

            // Clean customer name: display_name often defaults to the phone (duplicate) or is
            // junk ("??????") for test accounts — fall back to a neutral label in those cases.
            const custPhone = order.profiles?.phone || '';
            const rawName = order.profiles?.display_name || '';
            const custName = (!rawName || rawName === custPhone || /^[?\s]+$/.test(rawName)) ? 'زبون' : rawName;
            const isOpen = openOrders.has(order.id);
            const hasDetails = (order._items?.length ?? 0) > 0 || contentFields.length > 0 || hasDelivery;
            const designFiles: { id: string; label: string; download: () => void }[] = [];
            const orderAttachments: string[] = Array.isArray(details.attachment_urls) ? details.attachment_urls : [];
            orderAttachments.forEach((url, idx) => {
              if (!url) return;
              designFiles.push({
                id: `att-${idx}`,
                label: orderAttachments.length > 1 ? `الملف المرفوع ${idx + 1}` : 'الملف المرفوع',
                download: () => downloadDesignFromUrl(url, `design-${shortId}-${idx + 1}.${extOf(url)}`),
              });
            });
            // Item-level uploads — this is where AI-design images are stored (order_items.details.attachment_urls).
            (order._items || []).forEach((it, itemIdx) => {
              const itemD = (it.details || {}) as OrderDetailsJson;
              const urls: string[] = Array.isArray(itemD.attachment_urls) ? itemD.attachment_urls : [];
              const itemName = it.templates?.name || itemD.service_label || `عنصر ${itemIdx + 1}`;
              const isAi = itemD.is_ai_design === true;
              urls.forEach((url, idx) => {
                if (!url) return;
                const base = isAi ? `تصميم AI: ${itemName}` : `مرفق الزبون: ${itemName}`;
                designFiles.push({
                  id: `item-${it.id}-${idx}`,
                  label: urls.length > 1 ? `${base} (${idx + 1})` : base,
                  download: () => downloadDesignFromUrl(url, `design-${shortId}-${isAi ? 'ai' : 'att'}${itemIdx + 1}-${idx + 1}.${extOf(url)}`),
                });
              });
            });
            // Latest version per item (two-face items keep BOTH faces at that version).
            const latestVersionByItem = new Map<string, number>();
            (order._designs || []).forEach((d) => {
              if (!d.file_url) return;
              const k = d.order_item_id || 'legacy';
              const cur = latestVersionByItem.get(k);
              if (cur == null || d.version > cur) latestVersionByItem.set(k, d.version);
            });
            (order._designs || []).forEach((d) => {
              if (!d.file_url) return;
              const k = d.order_item_id || 'legacy';
              if (latestVersionByItem.get(k) !== d.version) return;
              const itemName = order._items?.find((it) => it.id === d.order_item_id)?.templates?.name;
              const faceLabel = d.face === 'front' ? ' — الوجه الأمامي' : d.face === 'back' ? ' — الوجه الخلفي' : '';
              const faceSuffix = d.face ? `-${d.face}` : '';
              designFiles.push({
                id: d.id,
                label: (itemName ? `تصميم: ${itemName}` : `تصميم المصمم (إصدار ${d.version})`) + faceLabel,
                download: () => downloadDesignFromBucket(d.file_url, `design-${shortId}-v${d.version}${faceSuffix}.${extOf(String(d.file_url))}`),
              });
            });

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                className="bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {order._items?.length > 1 ? <Package className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-primary" />}
                      </div>
                      <div>
                        {isReseller ? (
                          <>
                            <h3 className="font-bold text-foreground text-sm leading-tight flex items-center gap-2">
                              {details.service_label || SERVICE_LABELS[details.service_type] || 'طلب مطبعة'}
                              <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">مطبعة</Badge>
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-mono">#{order.id.slice(0, 8)}</span>
                            </p>
                          </>
                        ) : order._items?.length > 0 ? (
                          <>
                            <h3 className="font-bold text-foreground text-sm leading-tight">
                              {order._items.length > 1 ? `${order._items.length} عناصر` : (order._items[0]?.templates?.name || '-')}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="font-mono">#{order.id.slice(0, 8)}</span>
                            </p>
                          </>
                        ) : (
                          <>
                            <h3 className="font-bold text-foreground text-sm leading-tight">{order.templates?.name || '-'}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {SERVICE_LABELS[order.templates?.service_type ?? ''] || ''} · <span className="font-mono">#{order.id.slice(0, 8)}</span>
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={order.status as OrderStatus} />
                  </div>

                  {/* Order items summary */}
                  {order._items?.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {order._items.map((item, idx: number) => (
                        <div key={idx} className="text-[11px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground flex items-center gap-1">
                          <StatusBadge status={item.status as OrderStatus} />
                          {item.templates?.name || SERVICE_LABELS[item.templates?.service_type || ''] || '-'}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Customer info row + details toggle */}
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                      <User className="w-3.5 h-3.5" />
                      {custName}
                    </span>
                    {custPhone && (
                      <span className="flex items-center gap-1.5" dir="ltr">
                        <Phone className="w-3.5 h-3.5" />
                        {custPhone}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(order.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                    {hasDetails && (
                      <button
                        onClick={() => toggleOrder(order.id)}
                        className="mr-auto flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {isOpen ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Content Details (collapsible) — per item, or raw fields */}
                {isOpen && (order._items?.length > 0 ? (
                  <div className="px-4 pb-3 space-y-2">
                    {order._items.map((item, idx: number) => {
                      const itemD = (item.details || {}) as OrderDetailsJson;
                      return (
                        <div key={item.id} className="bg-muted/20 rounded-lg p-3 border border-border/50">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-foreground flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-primary/10 text-primary text-[11px] flex items-center justify-center font-bold">{idx + 1}</span>
                              {item.templates?.name || '-'}
                            </span>
                            <StatusBadge status={item.status as OrderStatus} />
                          </div>
                          {itemD.details && <p className="text-xs text-muted-foreground truncate">{itemD.details}</p>}
                          {itemD.quantity && <p className="text-[11px] text-muted-foreground">الكمية: {Number(itemD.quantity).toLocaleString()}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : contentFields.length > 0 ? (
                  <div className="px-4 pb-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                      {contentFields.map(f => (
                        <div key={f.key}>
                          <span className="text-muted-foreground">{f.label}</span>
                          <p className="text-foreground font-medium truncate">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null)}

                {/* Reseller order: design files + total */}
                {isReseller && (
                  <div className="mx-4 mb-3 bg-primary/5 border border-primary/10 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {resellerAttachments.length > 0 ? (
                        resellerAttachments.map((url, idx) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 bg-card border border-primary/20 rounded-lg px-2 py-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            التصميم {resellerAttachments.length > 1 ? idx + 1 : ''}
                          </a>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">لا يوجد ملف مرفق</span>
                      )}
                    </div>
                    {details.pricing?.total != null && (
                      <span className="text-sm font-extrabold text-primary">
                        {Number(details.pricing.total).toLocaleString('en-US')} د.ع
                      </span>
                    )}
                  </div>
                )}

                {/* Delivery Info (collapsible) */}
                {isOpen && hasDelivery && (
                  <div className="mx-4 mb-3 bg-primary/5 border border-primary/10 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                      <MapPin className="w-3.5 h-3.5" />
                      معلومات التوصيل
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                      {deliveryFields.map(f => (
                        <div key={f.key}>
                          <span className="text-muted-foreground">{f.label}</span>
                          <p className="text-foreground font-medium">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-border bg-muted/20 px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    <Select
                      value={order.designer_id || 'none'}
                      onValueChange={(val) => {
                        if (val !== 'none') handleAssignDesigner(order.id, val);
                      }}
                      disabled={order.status === 'print_ready' || order.status === 'printed' || order.status === 'delivered'}
                    >
                      <SelectTrigger className="w-40 h-8 text-xs rounded-lg">
                        <SelectValue placeholder="تعيين مصمم" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>اختر مصمم</SelectItem>
                        {designers.map(d => (
                          <SelectItem key={d.user_id} value={d.user_id}>
                            {d.is_active === false ? '🔴 ' : '🟢 '}
                            {d.display_name || d.phone || 'مصمم'}
                            {' '}({designerWorkload.find(w => w.user_id === d.user_id)?.activeOrders || 0} نشط)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <Select
                      value={order.status}
                      onValueChange={(val) => handleStatusChange(order.id, val)}
                    >
                      <SelectTrigger className="w-40 h-8 text-xs rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(order.status === 'print_ready'
                          ? (['print_ready', 'printed'] as OrderStatus[])
                          : ORDER_STATUSES
                        ).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Download design file(s) */}
                  {designFiles.length === 1 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={designFiles[0].download}
                    >
                      <Download className="w-3.5 h-3.5" />
                      تحميل التصميم
                    </Button>
                  ) : designFiles.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                          <Download className="w-3.5 h-3.5" />
                          تحميل التصميم ({designFiles.length})
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-48">
                        {designFiles.map(f => (
                          <DropdownMenuItem key={f.id} onClick={f.download} className="text-xs gap-2 cursor-pointer">
                            <Download className="w-3.5 h-3.5" />
                            {f.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}

                  {order.status !== 'draft' && order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 gap-1.5 mr-auto">
                          <XCircle className="w-3.5 h-3.5" />
                          إلغاء الطلب
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>إلغاء الطلب</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من إلغاء طلب <strong>{order.profiles?.display_name || order.profiles?.phone || 'هذا الزبون'}</strong>؟
                            سيتم إعادة حالته إلى مسودة وإلغاء تعيين المصمم.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-row-reverse gap-2">
                          <AlertDialogCancel>تراجع</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancelOrder(order.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            نعم، إلغاء الطلب
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default AdminOrdersTab;
