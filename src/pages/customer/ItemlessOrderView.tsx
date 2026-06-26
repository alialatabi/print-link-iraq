import { FileText, RefreshCw, MapPin, XCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isImageUrl } from '@/lib/designVault';
import type { OrderDetailsJson } from '@/types/db';

// ORDER_STEPS and ORDER_STEP_RANK mirror the constants in OrderTracking.tsx
// (kept here purely as display data — no state or fetching).
import { Package, Printer, Palette, Truck } from 'lucide-react';

const ORDER_STEPS = [
  { status: 'submitted', label: 'تم الإرسال', icon: FileText },
  { status: 'approved', label: 'قيد التنفيذ', icon: Palette },
  { status: 'print_ready', label: 'جاهز للطباعة', icon: Printer },
  { status: 'printed', label: 'تمت الطباعة', icon: Package },
  { status: 'delivered', label: 'تم التسليم', icon: Truck },
];

const ORDER_STEP_RANK: Record<string, number> = {
  submitted: 0, assigned: 1, design_uploaded: 1, waiting_approval: 1,
  approved: 1, print_ready: 2, printed: 3, delivered: 4,
};

interface ItemlessOrderViewProps {
  orderStatus: string;
  orderDetails: OrderDetailsJson;
  orderDesignUrls: string[];
  orderServiceLabel: string;
  orderQuantity: number | undefined;
  orderTotal: number | undefined;
  orderHasDelivery: boolean;
  orderCancelled: boolean;
  onLightboxView: (url: string) => void;
}

const ItemlessOrderView = ({
  orderStatus,
  orderDetails: od,
  orderDesignUrls,
  orderServiceLabel,
  orderQuantity,
  orderTotal,
  orderHasDelivery,
  orderCancelled,
  onLightboxView,
}: ItemlessOrderViewProps) => {
  const orderStepRank = ORDER_STEP_RANK[orderStatus] ?? 0;

  return (
    <div className="space-y-4">
      {/* Design preview */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
        <h4 className="font-bold text-foreground text-sm mb-4">التصميم</h4>
        {orderDesignUrls.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {orderDesignUrls.map((url, i) =>
              isImageUrl(url) ? (
                <img
                  key={i}
                  src={url}
                  alt={`تصميم ${i + 1}`}
                  draggable={false}
                  onContextMenu={e => e.preventDefault()}
                  onClick={() => onLightboxView(url)}
                  className="w-full aspect-square object-contain rounded-xl border border-border/50 bg-muted/20 cursor-zoom-in select-none"
                />
              ) : (
                <div
                  key={i}
                  className="aspect-square rounded-xl border border-border/50 bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground"
                >
                  <FileText className="w-10 h-10" />
                  <span className="text-xs">ملف التصميم</span>
                </div>
              ),
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <RefreshCw className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">يتم تجهيز طلبك...</p>
          </div>
        )}
      </div>

      {/* Summary */}
      {(orderServiceLabel || orderQuantity || orderTotal) && (
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5 space-y-2 text-sm">
          {orderServiceLabel && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">نوع الطباعة</span>
              <span className="font-semibold text-foreground">{orderServiceLabel}</span>
            </div>
          )}
          {orderQuantity != null && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">الكمية</span>
              <span className="font-semibold text-foreground">{orderQuantity.toLocaleString('en-US')}</span>
            </div>
          )}
          {orderTotal != null && orderTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">الإجمالي</span>
              <span className="font-bold text-success">{orderTotal.toLocaleString('en-US')} د.ع</span>
            </div>
          )}
        </div>
      )}

      {/* Status timeline */}
      {orderCancelled ? (
        <div className="bg-destructive/8 rounded-2xl p-5 border border-destructive/20 text-center">
          <XCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
          <p className="font-medium text-foreground text-sm">تم إلغاء هذا الطلب</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
          <h4 className="font-bold text-foreground text-sm mb-4">مراحل الطلب</h4>
          <div className="space-y-2">
            {ORDER_STEPS.map((step, i) => {
              const isComplete = i <= orderStepRank;
              const isCurrent = i === orderStepRank;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                    isComplete ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
                    isCurrent && 'ring-2 ring-success/30 ring-offset-1 ring-offset-background',
                  )}>
                    <step.icon className="w-3.5 h-3.5" />
                  </div>
                  <p className={cn('font-medium text-sm flex-1', isComplete ? 'text-foreground' : 'text-muted-foreground')}>
                    {step.label}
                  </p>
                  {isComplete && <CheckCircle className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delivery address */}
      {orderHasDelivery && (
        <div className="bg-card rounded-2xl border border-border/60 shadow-card p-5">
          <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
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
    </div>
  );
};

export default ItemlessOrderView;
