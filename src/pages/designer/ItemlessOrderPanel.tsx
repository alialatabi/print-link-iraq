import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Upload, FileText, Image, CheckCircle2, RefreshCw,
  Printer, MapPin, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AttachmentGallery from './AttachmentGallery';
import DesignVersionList from '@/components/designer/DesignVersionList';
import FaceUploadZones, { type FaceZoneState } from '@/components/designer/FaceUploadZones';
import { hasBothFaces, type DesignFace } from '@/lib/designUtils';
import type { OrderDetailsJson } from '@/types/db';
import type { DesignVersion } from './DesignItemCard';

interface ItemlessOrderPanelProps {
  orderStatus: string;
  details: OrderDetailsJson;
  /** customer-attached design/reference files (public order-attachments URLs) */
  attachments: string[];
  serviceLabel: string;
  quantity?: number;
  total?: number;
  /** order-level designs the designer uploaded (order_item_id IS NULL) */
  orderDesigns: DesignVersion[];
  uploading: boolean;
  printing: boolean;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onSendToPrint: () => Promise<void>;
  onDeleteDesign: (design: DesignVersion) => Promise<void>;
  /** 1 (default) = single upload zone; 2 = two labelled face zones (front/back). */
  faces?: 1 | 2;
  /** Two-face only: per-face upload state for the order-level upload. */
  faceState?: { front: FaceZoneState; back: FaceZoneState } | null;
  /** Two-face only: shared input refs (keyed `order:${face}`). */
  fileInputRefs?: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onFaceFileSelect?: (e: React.ChangeEvent<HTMLInputElement>, face: DesignFace) => Promise<void>;
  onFaceRetry?: (face: DesignFace) => void;
}

const ItemlessOrderPanel = ({
  orderStatus,
  details: od,
  attachments,
  serviceLabel,
  quantity,
  total,
  orderDesigns,
  uploading,
  printing,
  fileInputRef,
  onFileSelect,
  onSendToPrint,
  onDeleteDesign,
  faces = 1,
  faceState = null,
  fileInputRefs,
  onFaceFileSelect,
  onFaceRetry,
}: ItemlessOrderPanelProps) => {
  const isTwoFace = faces === 2;
  const canUpload = ['submitted', 'assigned', 'design_uploaded'].includes(orderStatus);
  const hasUploadedDesign = orderDesigns.some(d => d.file_url);
  const bothFaces = hasBothFaces(orderDesigns);
  // Two-face needs both faces; single-face keeps the original (any upload OR a customer attachment).
  const canSendToPrint = canUpload && (isTwoFace ? bothFaces : (hasUploadedDesign || attachments.length > 0));
  const needsSecondFace = isTwoFace && canUpload && orderDesigns.length > 0 && !bothFaces;
  const hasDelivery = Boolean(od.delivery_province || od.delivery_phone);

  return (
    <div className="space-y-4">
      {/* Customer brief + attachments + summary */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          تفاصيل الزبون
        </h4>
        {od.details ? (
          <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-xl p-4 border border-border/50">
            {od.details}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">لا توجد تفاصيل</p>
        )}

        {/* Summary */}
        {(serviceLabel || quantity || total) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-3">
            {serviceLabel && (
              <div>
                <span className="text-muted-foreground text-xs">نوع الطباعة</span>
                <p className="text-foreground font-medium">{serviceLabel}</p>
              </div>
            )}
            {quantity != null && (
              <div>
                <span className="text-muted-foreground text-xs">الكمية</span>
                <p className="text-foreground font-medium">{quantity.toLocaleString('en-US')}</p>
              </div>
            )}
            {total != null && total > 0 && (
              <div>
                <span className="text-muted-foreground text-xs">الإجمالي</span>
                <p className="text-success font-bold">{total.toLocaleString('en-US')} د.ع</p>
              </div>
            )}
          </div>
        )}

        {/* Customer attachments */}
        {attachments.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              مرفقات الزبون ({attachments.length})
            </p>
            {/* Full-size, uncropped images + download — the designer works from these files. */}
            <AttachmentGallery urls={attachments} />
          </div>
        )}
      </div>

      {/* Delivery address */}
      {hasDelivery && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h4 className="font-bold text-foreground text-sm mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> عنوان التوصيل
          </h4>
          <div className="space-y-1 text-sm">
            {(od.delivery_province || od.delivery_area) && (
              <p className="text-foreground/80">
                {od.delivery_province}
                {od.delivery_area ? ` — ${od.delivery_area}` : ''}
                {od.delivery_landmark ? ` — ${od.delivery_landmark}` : ''}
              </p>
            )}
            {od.delivery_phone && (
              <p className="text-muted-foreground" dir="ltr">{od.delivery_phone}</p>
            )}
          </div>
        </div>
      )}

      {/* Designer work area */}
      <div className="bg-card rounded-xl border border-border p-4">
        {/* Upload — two labelled face zones for two-face products, else the single dropzone */}
        {canUpload && isTwoFace && faceState && fileInputRefs ? (
          <div className="mb-4">
            <FaceUploadZones
              canUpload={canUpload}
              keyPrefix="order"
              front={faceState.front}
              back={faceState.back}
              inputRefs={fileInputRefs}
              onFileSelect={(e, face) => { void onFaceFileSelect?.(e, face); }}
              onRetry={(face) => onFaceRetry?.(face)}
            />
          </div>
        ) : canUpload ? (
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff"
              onChange={onFileSelect}
              className="hidden"
            />
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                uploading ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-8 h-8 text-primary mx-auto mb-2 animate-spin" />
                  <p className="text-foreground font-medium text-sm">جاري الرفع...</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-foreground font-medium text-sm">
                    {hasUploadedDesign ? 'رفع إصدار جديد' : 'رفع التصميم'}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">PDF, PNG, JPG, TIF — حتى 10MB</p>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* Two-face: remind the designer both faces are required before sending. */}
        {needsSecondFace && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-4">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              ارفع الوجهين قبل الإرسال
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              هذا المنتج بوجهين — ارفع الوجه الأمامي والوجه الخلفي معاً قبل الإرسال للطبع.
            </p>
          </div>
        )}

        {/* Uploaded design versions — shared list: in-app lightbox + forced download per version */}
        {orderDesigns.length > 0 && (
          <div className="mb-4">
            <DesignVersionList
              designs={orderDesigns}
              faces={faces}
              canDelete={() => canUpload}
              onDelete={onDeleteDesign}
            />
          </div>
        )}

        {/* Send to print */}
        {canSendToPrint && (
          <div>
            <Button
              onClick={onSendToPrint}
              disabled={printing}
              size="lg"
              className="w-full bg-success hover:bg-success/90 text-success-foreground rounded-xl"
            >
              <CheckCircle2 className="w-4 h-4 ml-2" />
              {printing ? 'جاري الإرسال...' : 'الموافقة على التصميم وإرساله للطبع 🖨'}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-1.5">
              {hasUploadedDesign
                ? 'سيتم إرسال أحدث نسخة مرفوعة للطباعة مباشرة'
                : 'سيتم إرسال ملف الزبون المرفق للطباعة مباشرة'}
            </p>
          </div>
        )}

        {/* Completed states */}
        {orderStatus === 'print_ready' && (
          <div className="bg-success/10 rounded-lg p-4 text-center">
            <Printer className="w-5 h-5 text-success mx-auto mb-2" />
            <p className="font-medium text-foreground text-sm">تم تحويل الطلب للطبع!</p>
          </div>
        )}
        {['printed', 'delivered'].includes(orderStatus) && (
          <div className="bg-success/10 rounded-lg p-4 text-center">
            <CheckCircle2 className="w-5 h-5 text-success mx-auto mb-2" />
            <p className="font-medium text-foreground text-sm">
              {orderStatus === 'delivered' ? 'تم تسليم الطلب' : 'تمت طباعة الطلب'}
            </p>
          </div>
        )}

        {/* Nothing to act on yet (no design uploaded, no customer file, not printable) */}
        {!canSendToPrint && !['print_ready', 'printed', 'delivered'].includes(orderStatus) && !canUpload && (
          <p className="text-muted-foreground text-sm text-center">لا توجد إجراءات متاحة لهذا الطلب حالياً</p>
        )}
      </div>
    </div>
  );
};

export default ItemlessOrderPanel;
