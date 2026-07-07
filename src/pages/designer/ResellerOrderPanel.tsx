import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Store, Image, FileText, ExternalLink, CheckCircle2, Pencil, MessageSquare,
} from 'lucide-react';
import type { OrderDetailsJson } from '@/types/db';

interface ResellerOrderPanelProps {
  orderStatus: string;
  resellerDetails: OrderDetailsJson;
  resellerAttachments: string[];
  cellophaneLabel: string | null;
  canReview: boolean;
  reviewNote: string;
  setReviewNote: (note: string) => void;
  reviewSubmitting: 'approve' | 'reject' | null;
  onReview: (result: 'approved' | 'rejected') => void;
}

const ResellerOrderPanel = ({
  orderStatus,
  resellerDetails,
  resellerAttachments,
  cellophaneLabel,
  canReview,
  reviewNote,
  setReviewNote,
  reviewSubmitting,
  onReview,
}: ResellerOrderPanelProps) => {
  const review = resellerDetails.review;

  return (
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
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative rounded-xl overflow-hidden border border-border/60 aspect-square bg-muted/20 group hover:border-primary/40 transition-colors flex items-center justify-center"
                >
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

      {/* Approved / rejected state */}
      {orderStatus === 'approved' || ['print_ready', 'printed', 'delivered'].includes(orderStatus) ? (
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
          {review.note && (
            <p className="text-foreground text-sm mt-2 bg-card rounded-lg p-3 border border-border/50 break-words">
              {review.note}
            </p>
          )}
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
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => onReview('approved')}
              disabled={reviewSubmitting !== null}
              className="w-full sm:flex-1 bg-success hover:bg-success/90 text-success-foreground"
            >
              <CheckCircle2 className="w-4 h-4 ml-1" />
              {reviewSubmitting === 'approve' ? 'جاري...' : 'موافقة وإرسال للطباعة'}
            </Button>
            <Button
              onClick={() => onReview('rejected')}
              disabled={reviewSubmitting !== null}
              variant="outline"
              className="w-full sm:flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Pencil className="w-4 h-4 ml-1" />
              {reviewSubmitting === 'reject' ? 'جاري...' : 'إرسال تعديل للزبون'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResellerOrderPanel;
